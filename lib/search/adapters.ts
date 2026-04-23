// ============================================================
// 検索アダプタ（ローカルDB + 外部API）
// ============================================================

import {
  normalizeText,
  katakanaToHiragana,
  cleanIsbn,
  normalizeIsbn,
  isIsbnLike,
  tokenizeQuery,
  removeSymbols,
  normalizePublisher,
  extractLabel,
} from "../normalize";
import { prisma } from "../db";
import type { RRFBook, RRFInput } from "./rrf";

export interface ExternalBookData extends RRFBook {}

// ============================================================
// ローカルDB検索
// ============================================================
export async function searchLocalDb(query: string): Promise<RRFBook[]> {
  try {
    const normalizedQuery = normalizeText(query);
    const tokens = tokenizeQuery(normalizedQuery);
    if (tokens.length === 0) return [];

    // ISBN検索
    if (isIsbnLike(normalizedQuery)) {
      const isbn13 = normalizeIsbn(normalizedQuery);
      const cleanQ = cleanIsbn(normalizedQuery);
      const book = await prisma.book.findFirst({
        where: {
          OR: [
            ...(isbn13 ? [{ isbn: isbn13 }] : []),
            { isbn: cleanQ },
          ],
        },
      });
      if (book) return [dbBookToRRF(book)];
      return [];
    }

    // キーワード検索
    const normalizedTokens = tokens.map((t) => removeSymbols(normalizeText(t)).toLowerCase());
    const hiraganaTokens = normalizedTokens.map((t) => katakanaToHiragana(t));

    const books = await prisma.book.findMany({
      where: {
        AND: normalizedTokens.map((token, i) => ({
          OR: [
            { titleNormalized: { contains: token } },
            { title: { contains: tokens[i] } },
            { author: { contains: tokens[i] } },
            { titleNormalized: { contains: hiraganaTokens[i] } },
            { author: { contains: hiraganaTokens[i] } },
            { seriesName: { contains: tokens[i] } },
            { label: { contains: tokens[i] } },
            { publisher: { contains: tokens[i] } },
          ],
        })),
      },
      take: 100,
      orderBy: { customRank: "desc" },
    });

    return books.map((b) => dbBookToRRF(b));
  } catch {
    return [];
  }
}

function dbBookToRRF(book: {
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  label: string | null;
  publishedDate: string | null;
  totalPages: number;
  coverImageUrl: string | null;
  description: string | null;
}): RRFBook {
  return {
    isbn: book.isbn,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    label: book.label,
    publishedDate: book.publishedDate,
    totalPages: book.totalPages,
    coverImageUrl: book.coverImageUrl,
    description: book.description,
  };
}

// ============================================================
// 楽天ブックス（複数パターン並列で精度向上）
// ============================================================
async function searchRakutenSingle(
  params: Record<string, string>,
): Promise<ExternalBookData[]> {
  const appId = process.env.RAKUTEN_APPLICATION_ID;
  if (!appId) return [];
  try {
    const url = new URL("https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404");
    url.searchParams.set("applicationId", appId);
    url.searchParams.set("hits", "20");
    url.searchParams.set("sort", "standard");
    url.searchParams.set("booksGenreId", "001");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.Items?.length) return [];
    return data.Items.map((wrapper: Record<string, unknown>) => {
      const item = (wrapper.Item || wrapper) as Record<string, unknown>;
      const isbn = item.isbn as string | undefined;
      const rawTitle = (item.title as string) || "不明";
      const { title: cleanTitle, label: extractedLabel } = extractLabel(rawTitle);
      return {
        isbn: isbn ? cleanIsbn(isbn) : null,
        title: cleanTitle,
        author: (item.author as string) || "不明",
        publisher: (item.publisherName as string) || null,
        label: (item.seriesName as string) || extractedLabel,
        publishedDate: (item.salesDate as string) || null,
        totalPages: parseInt(item.itemPages as string, 10) || 0,
        coverImageUrl: (item.largeImageUrl as string) || (item.mediumImageUrl as string) || null,
        description: (item.itemCaption as string) || null,
      } satisfies ExternalBookData;
    });
  } catch {
    return [];
  }
}

/**
 * 楽天ブックスを複数パターンで並列検索し、各パターンの結果をRRF入力として返す
 */
export async function searchRakutenEnhanced(query: string): Promise<RRFInput[]> {
  const appId = process.env.RAKUTEN_APPLICATION_ID;
  if (!appId) return [];

  const normalized = normalizeText(query);
  const [byTitle, byAuthor] = await Promise.all([
    searchRakutenSingle({ title: normalized }),
    searchRakutenSingle({ author: normalized }),
  ]);

  const results: RRFInput[] = [];
  if (byTitle.length > 0) {
    results.push({ source: "rakuten_title", books: byTitle, weight: 1.4 });
  }
  if (byAuthor.length > 0) {
    results.push({ source: "rakuten_author", books: byAuthor, weight: 1.1 });
  }
  return results;
}

// ============================================================
// Google Books
// ============================================================
export async function searchGoogleBooks(query: string): Promise<ExternalBookData[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || "";
  const keyParam = apiKey ? `&key=${apiKey}` : "";
  try {
    const normalized = normalizeText(query);
    const url =
      `https://www.googleapis.com/books/v1/volumes?` +
      `q=${encodeURIComponent(normalized)}` +
      `&langRestrict=ja&maxResults=20&printType=books&orderBy=relevance${keyParam}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.items?.length) return [];
    return data.items.map((item: Record<string, unknown>) => {
      const info = item.volumeInfo as Record<string, unknown>;
      const identifiers = info.industryIdentifiers as { type: string; identifier: string }[] | undefined;
      const rawIsbn =
        identifiers?.find((id) => id.type === "ISBN_13")?.identifier ||
        identifiers?.find((id) => id.type === "ISBN_10")?.identifier || null;
      let isbn = rawIsbn;
      if (rawIsbn) isbn = normalizeIsbn(rawIsbn) || rawIsbn;
      const imageLinks = info.imageLinks as { thumbnail?: string } | undefined;
      const rawTitle = (info.title as string) || "不明";
      const { title: gTitle, label: gLabel } = extractLabel(rawTitle);
      return {
        isbn,
        title: gTitle,
        author: (info.authors as string[] | undefined)?.join(", ") || "不明",
        publisher: (info.publisher as string) || null,
        label: gLabel,
        publishedDate: (info.publishedDate as string) || null,
        totalPages: (info.pageCount as number) || 0,
        coverImageUrl: imageLinks?.thumbnail?.replace("http://", "https://") || null,
        description: (info.description as string) || null,
      } satisfies ExternalBookData;
    });
  } catch {
    return [];
  }
}

// ============================================================
// NDL（国立国会図書館）
// ============================================================
export async function searchNdl(query: string): Promise<ExternalBookData[]> {
  try {
    const normalized = normalizeText(query);
    const url = `https://ndlsearch.ndl.go.jp/api/opensearch?title=${encodeURIComponent(normalized)}&cnt=20`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const results: ExternalBookData[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];
      const categories = [...item.matchAll(/<category>([^<]+)<\/category>/g)].map((m) => m[1]);
      if (!categories.includes("図書")) continue;
      const titleMatch = item.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch?.[1] || "";
      if (!title) continue;
      const authorMatch = item.match(/<dc:creator>([^<]+)<\/dc:creator>/);
      let author = authorMatch?.[1] || "不明";
      author = author.replace(/,\s*\d{4}[-−].*$/, "").trim();
      const isbnMatch = item.match(/xsi:type="dcndl:ISBN">([^<]+)/);
      const rawIsbn = isbnMatch ? isbnMatch[1].replace(/-/g, "") : null;
      const isbn = rawIsbn ? normalizeIsbn(rawIsbn) || (rawIsbn.length >= 10 ? rawIsbn : null) : null;
      const publisherMatch = item.match(/<dc:publisher>([^<]+)<\/dc:publisher>/);
      const publisher = publisherMatch?.[1] || null;
      const dateMatch = item.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/);
      const publishedDate = dateMatch?.[1] || null;
      const { title: ndlTitle, label: ndlLabel } = extractLabel(title);
      const extentMatch = item.match(/<dcterms:extent>([^<]+)<\/dcterms:extent>/);
      let totalPages = 0;
      if (extentMatch) {
        const pagesMatch = extentMatch[1].match(/(\d+)\s*(?:p|ページ)/);
        if (pagesMatch) totalPages = parseInt(pagesMatch[1], 10);
      }
      const coverImageUrl = isbn ? `https://ndlsearch.ndl.go.jp/thumbnail/${isbn}.jpg` : null;
      if (results.some((r) => r.isbn && isbn && r.isbn === isbn)) continue;
      results.push({
        isbn, title: ndlTitle, author, publisher, label: ndlLabel,
        publishedDate, totalPages, coverImageUrl, description: null,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ============================================================
// 外部API結果をDBにUpsert（バックグラウンド）
// ============================================================
export function upsertExternalResults(results: ExternalBookData[]): void {
  (async () => {
    try {
      for (const r of results) {
        if (!r.isbn) continue;
        const titleNormalized = removeSymbols(normalizeText(r.title)).toLowerCase();
        const pubNorm = r.publisher ? normalizePublisher(r.publisher) : null;
        const labelNorm = r.label ? normalizePublisher(r.label) : null;
        let completeness = 0;
        if (r.coverImageUrl) completeness += 5;
        if (r.isbn) completeness += 3;
        if (r.author && r.author !== "不明") completeness += 2;
        if (r.publishedDate) completeness += 2;
        if (r.publisher) completeness += 3;

        await prisma.book.upsert({
          where: { isbn: r.isbn },
          create: {
            isbn: r.isbn,
            title: r.title,
            titleNormalized,
            author: r.author,
            publisher: r.publisher,
            publisherNormalized: pubNorm,
            label: r.label,
            labelNormalized: labelNorm,
            publishedDate: r.publishedDate,
            totalPages: r.totalPages,
            coverImageUrl: r.coverImageUrl,
            description: r.description,
            completenessScore: completeness,
          },
          update: {
            coverImageUrl: r.coverImageUrl || undefined,
            totalPages: r.totalPages > 0 ? r.totalPages : undefined,
            description: r.description || undefined,
            publisher: r.publisher || undefined,
            publisherNormalized: pubNorm || undefined,
            label: r.label || undefined,
            publishedDate: r.publishedDate || undefined,
          },
        });
      }
    } catch {
      // DB書き込み失敗は無視
    }
  })();
}
