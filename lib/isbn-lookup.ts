import { prisma } from "./db";
import { isbnVariants, normalizeLookupIsbn } from "./isbn";

interface BookData {
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publishedDate: string | null;
  totalPages: number;
  coverImageUrl: string | null;
  description: string | null;
}

export interface IsbnLookupBook extends BookData {
  bookDbId: string | null;
  workDbId?: string | null;
  readingCount: number;
  completedCount: number;
  eventCount: number;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pageCount(value: unknown): number {
  const count = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof count === "number" && Number.isInteger(count) && count > 0 ? count : 0;
}

function imageUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error("ISBN source unavailable");
  return response.json();
}

interface OpenBdEntry {
  summary?: { isbn?: string; title?: string; author?: string; publisher?: string; pubdate?: string; cover?: string };
  onix?: {
    DescriptiveDetail?: { Extent?: { ExtentType?: string; ExtentUnit?: string; ExtentValue?: string }[] };
    CollateralDetail?: { TextContent?: { TextType?: string; Text?: string }[] };
  };
}

async function fromOpenBd(isbn: string): Promise<BookData | null> {
  const url = new URL("https://api.openbd.jp/v1/get");
  url.searchParams.set("isbn", isbn);
  const data = await fetchJson(url);
  if (!Array.isArray(data)) throw new Error("Invalid ISBN source response");
  const entry: OpenBdEntry | undefined = data.find((item: OpenBdEntry | null) =>
    normalizeLookupIsbn(item?.summary?.isbn) === isbn && text(item?.summary?.title));
  if (!entry?.summary) return null;
  const summary = entry.summary;
  const extents = entry.onix?.DescriptiveDetail?.Extent;
  const extent = Array.isArray(extents) ? extents.find(item =>
    ["11", "00"].includes(item.ExtentType ?? "") && item.ExtentUnit === "03") : undefined;
  const content = entry.onix?.CollateralDetail?.TextContent;
  const description = Array.isArray(content) ? content.find(item =>
    ["02", "03"].includes(item.TextType ?? "") && text(item.Text))?.Text : null;
  return {
    isbn, title: summary.title!, author: text(summary.author) ?? "著者不明",
    publisher: text(summary.publisher), publishedDate: text(summary.pubdate),
    totalPages: pageCount(extent?.ExtentValue), coverImageUrl: imageUrl(summary.cover),
    description: text(description),
  };
}

interface GoogleVolume {
  volumeInfo?: {
    title?: string; authors?: string[]; publisher?: string; publishedDate?: string;
    pageCount?: number; description?: string; imageLinks?: { thumbnail?: string };
    industryIdentifiers?: { type?: string; identifier?: string }[];
  };
}

async function fromGoogle(isbn: string): Promise<BookData | null> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `isbn:${isbn}`);
  url.searchParams.set("maxResults", "10");
  if (process.env.GOOGLE_BOOKS_API_KEY) url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  const data = await fetchJson(url) as { items?: GoogleVolume[]; totalItems?: number } | null;
  if (!data || (!Array.isArray(data.items) && data.totalItems !== 0)) {
    throw new Error("Invalid ISBN source response");
  }
  const info = data.items?.find(item => {
    const identifiers = item?.volumeInfo?.industryIdentifiers;
    return Array.isArray(identifiers) && identifiers.some(identifier =>
      ["ISBN_10", "ISBN_13"].includes(identifier.type ?? "") && normalizeLookupIsbn(identifier.identifier) === isbn);
  })?.volumeInfo;
  if (!info || !text(info.title)) return null;
  return {
    isbn, title: info.title!, author: info.authors?.filter(author => text(author)).join(", ") || "著者不明",
    publisher: text(info.publisher), publishedDate: text(info.publishedDate),
    totalPages: pageCount(info.pageCount), coverImageUrl: imageUrl(info.imageLinks?.thumbnail),
    description: text(info.description),
  };
}

interface OpenLibraryEntry {
  title?: string; authors?: { name?: string }[]; publishers?: { name?: string }[];
  publish_date?: string; number_of_pages?: number; cover?: { medium?: string; large?: string };
  identifiers?: { isbn_10?: string[]; isbn_13?: string[] };
}

async function fromOpenLibrary(isbn: string): Promise<BookData | null> {
  const url = new URL("https://openlibrary.org/api/books");
  url.searchParams.set("bibkeys", `ISBN:${isbn}`);
  url.searchParams.set("jscmd", "data");
  url.searchParams.set("format", "json");
  const data = await fetchJson(url) as Record<string, OpenLibraryEntry> | null;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid ISBN source response");
  const entry = data[`ISBN:${isbn}`];
  const identifiers = [...(entry?.identifiers?.isbn_13 ?? []), ...(entry?.identifiers?.isbn_10 ?? [])];
  if (!entry || !text(entry.title) || !identifiers.some(value => normalizeLookupIsbn(value) === isbn)) return null;
  return {
    isbn, title: entry.title!, author: entry.authors?.map(author => text(author.name)).filter(Boolean).join(", ") || "著者不明",
    publisher: entry.publishers?.map(publisher => text(publisher.name)).filter(Boolean).join(", ") || null,
    publishedDate: text(entry.publish_date), totalPages: pageCount(entry.number_of_pages),
    coverImageUrl: imageUrl(entry.cover?.large ?? entry.cover?.medium), description: null,
  };
}

/** Independent, read-only ISBN lookup: no keyword ranking, caching writes or matching. */
export async function lookupIsbn(isbn: string): Promise<{ book: IsbnLookupBook | null; unavailable: boolean }> {
  const variants = isbnVariants(isbn);
  const books = await prisma.book.findMany({
    where: { isbn: { in: variants } },
    select: {
      id: true, isbn: true, title: true, author: true, publisher: true, publishedDate: true,
      totalPages: true, coverImageUrl: true, description: true,
    },
  });
  const local = books.find(book => book.isbn === isbn) ?? books[0];
  if (local) {
    const [readingCount, completedCount, eventCount] = await Promise.all([
      prisma.readingStatus.count({ where: { bookId: local.id, status: "READING" } }),
      prisma.readingStatus.count({ where: { bookId: local.id, status: "COMPLETED" } }),
      prisma.readingEvent.count({ where: {
        OR: [{ bookId: local.id }, { books: { some: { id: local.id } } }],
        eventDate: { gte: new Date() },
      } }),
    ]);
    return { book: { ...local, isbn: local.isbn ?? isbn, bookDbId: local.id, readingCount, completedCount, eventCount }, unavailable: false };
  }

  const edition = await prisma.edition.findFirst({
    where: { OR: [{ isbn13: isbn }, { isbn10: { in: variants } }] },
    select: {
      titleOnCover: true, publisher: true, publishedAt: true, pageCount: true, coverImageUrl: true,
      work: { select: { id: true, title: true, author: true, description: true } },
    },
  });
  if (edition) {
    return { book: {
      isbn, title: edition.titleOnCover || edition.work.title, author: edition.work.author,
      publisher: edition.publisher, publishedDate: edition.publishedAt?.toISOString().slice(0, 10) ?? null,
      totalPages: edition.pageCount ?? 0, coverImageUrl: edition.coverImageUrl, description: edition.work.description,
      bookDbId: null, workDbId: edition.work.id, readingCount: 0, completedCount: 0, eventCount: 0,
    }, unavailable: false };
  }

  let unavailable = false;
  for (const source of [fromOpenBd, fromGoogle, fromOpenLibrary]) {
    try {
      const book = await source(isbn);
      if (book) return { book: { ...book, bookDbId: null, readingCount: 0, completedCount: 0, eventCount: 0 }, unavailable: false };
    } catch {
      unavailable = true;
    }
  }
  return { book: null, unavailable };
}
