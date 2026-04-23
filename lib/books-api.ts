import {
  normalizeText,
  katakanaToHiragana,
  cleanIsbn,
  normalizeIsbn,
  isbn10to13,
  isIsbnLike,
  tokenizeQuery,
  removeSymbols,
  normalizePublisher,
  extractLabel,
} from "./normalize";
import { prisma } from "./db";
import { getMatchScore } from "./ranking/score";

export interface BookSearchResult {
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  label: string | null;
  publishedDate: string | null;
  totalPages: number;
  coverImageUrl: string | null;
  description: string | null;
  // DB由来
  bookDbId: string | null;
  customRank: number;
  publisherTier: string;
  readingCount: number;
  completedCount: number;
  eventCount: number;
  // 検索スコア
  _matchScore: number;
  _finalScore: number;
}

// ============================================================
// 自社DB検索（メイン・customRankでソート）
// ============================================================
async function searchLocalDb(query: string): Promise<BookSearchResult[]> {
  try {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return [];

    // ISBN検索
    if (isIsbnLike(query)) {
      const isbn13 = normalizeIsbn(query);
      const cleanQ = cleanIsbn(query);
      const book = await prisma.book.findFirst({
        where: {
          OR: [
            ...(isbn13 ? [{ isbn: isbn13 }] : []),
            { isbn: cleanQ },
          ],
        },
        include: {
          readings: { select: { status: true } },
        },
      });
      if (book) {
        return [mapDbBookToResult(book, query)];
      }
      return [];
    }

    // キーワード検索: titleNormalized と author で AND検索
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
      include: {
        readings: { select: { status: true } },
      },
      take: 200, // 多めに取得してスコアでソート
      orderBy: { customRank: "desc" },
    });

    return books.map((book) => mapDbBookToResult(book, query));
  } catch {
    return [];
  }
}

// DB Bookモデル → BookSearchResult
function mapDbBookToResult(
  book: {
    id: string;
    isbn: string | null;
    title: string;
    author: string;
    publisher: string | null;
    label: string | null;
    publishedDate: string | null;
    totalPages: number;
    coverImageUrl: string | null;
    description: string | null;
    customRank: number;
    publisherTier: string;
    readings: { status: string }[];
  },
  query: string,
): BookSearchResult {
  const readingCount = book.readings.filter((r) => r.status === "READING").length;
  const completedCount = book.readings.filter((r) => r.status === "COMPLETED").length;
  const matchScore = getMatchScore(query, book.title, book.author);

  // 最終スコア = customRank(事前計算) + matchScore(検索時) × 3（マッチ重要度を強調）
  const finalScore = book.customRank + matchScore * 3;

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
    bookDbId: book.id,
    customRank: book.customRank,
    publisherTier: book.publisherTier,
    readingCount,
    completedCount,
    eventCount: 0,
    _matchScore: matchScore,
    _finalScore: finalScore,
  };
}

// ============================================================
// 外部API（フォールバック用・自社DBに結果がない場合のみ）
// ============================================================

interface ExternalBookData {
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  label: string | null;
  publishedDate: string | null;
  totalPages: number;
  coverImageUrl: string | null;
  description: string | null;
}

async function searchRakuten(query: string): Promise<ExternalBookData[]> {
  const appId = process.env.RAKUTEN_APPLICATION_ID;
  if (!appId) return [];
  try {
    const url = `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?applicationId=${appId}&title=${encodeURIComponent(normalizeText(query))}&hits=30&sort=sales`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
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
      };
    });
  } catch { return []; }
}

async function searchGoogleBooks(query: string): Promise<ExternalBookData[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || "";
  const keyParam = apiKey ? `&key=${apiKey}` : "";
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(normalizeText(query))}&maxResults=20&printType=books&orderBy=relevance${keyParam}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.items?.length) return [];
    return data.items.map((item: Record<string, unknown>) => {
      const info = item.volumeInfo as Record<string, unknown>;
      const identifiers = info.industryIdentifiers as { type: string; identifier: string }[] | undefined;
      const rawIsbn = identifiers?.find((id) => id.type === "ISBN_13")?.identifier
        || identifiers?.find((id) => id.type === "ISBN_10")?.identifier || null;
      let isbn = rawIsbn;
      if (rawIsbn) { isbn = normalizeIsbn(rawIsbn) || rawIsbn; }
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
      };
    });
  } catch { return []; }
}

async function searchNdl(query: string): Promise<ExternalBookData[]> {
  try {
    const url = `https://ndlsearch.ndl.go.jp/api/opensearch?title=${encodeURIComponent(normalizeText(query))}&cnt=30`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
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
      results.push({ isbn, title: ndlTitle, author, publisher, label: ndlLabel, publishedDate, totalPages, coverImageUrl, description: null });
    }
    return results;
  } catch { return []; }
}

// 外部API結果を自社DBにUpsert
async function upsertExternalResults(results: ExternalBookData[]): Promise<void> {
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
    // DB書き込み失敗は検索結果に影響させない
  }
}

// ============================================================
// メイン検索関数
// 戦略: 自社DB完結 → 不足時のみ外部APIフォールバック
// ============================================================
export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const normalizedQuery = normalizeText(query);

  // 1. 自社DB検索
  const localResults = await searchLocalDb(normalizedQuery);

  // 自社DBに十分な結果がある場合（5件以上かつ上位のmatchScoreが高い）
  const goodResults = localResults.filter((r) => r._matchScore >= 10);
  if (goodResults.length >= 5) {
    // totalPages=0の本をバックグラウンドでNDLから補完
    const missingPages = localResults.filter((r) => r.totalPages === 0 && r.isbn);
    if (missingPages.length > 0) {
      searchNdl(normalizedQuery).then((ndlResults) => {
        for (const ndl of ndlResults) {
          if (ndl.isbn && ndl.totalPages > 0) {
            prisma.book.updateMany({
              where: { isbn: ndl.isbn, totalPages: 0 },
              data: { totalPages: ndl.totalPages },
            }).catch(() => {});
          }
        }
      }).catch(() => {});
    }
    localResults.sort((a, b) => b._finalScore - a._finalScore);
    return localResults.slice(0, 30);
  }

  // 2. 外部APIフォールバック（自社DBに結果が不足）
  const [rakutenResults, googleResults, ndlResults] = await Promise.all([
    searchRakuten(normalizedQuery),
    searchGoogleBooks(normalizedQuery),
    searchNdl(normalizedQuery),
  ]);

  // 同ISBNの結果をマージ（totalPagesが取れたものを優先）
  const mergedByIsbn = new Map<string, ExternalBookData>();
  for (const r of [...rakutenResults, ...googleResults, ...ndlResults]) {
    if (!r.isbn) continue;
    const existing = mergedByIsbn.get(r.isbn);
    if (!existing) {
      mergedByIsbn.set(r.isbn, r);
    } else {
      if (r.totalPages > 0 && existing.totalPages === 0) existing.totalPages = r.totalPages;
      if (r.coverImageUrl && !existing.coverImageUrl) existing.coverImageUrl = r.coverImageUrl;
      if (r.description && !existing.description) existing.description = r.description;
    }
  }
  const noIsbnResults = [...rakutenResults, ...googleResults, ...ndlResults].filter((r) => !r.isbn);
  const externalResults = [...mergedByIsbn.values(), ...noIsbnResults];

  // 外部結果をDBに保存（バックグラウンド）
  if (externalResults.length > 0) {
    upsertExternalResults(externalResults);
  }

  // 外部結果をBookSearchResult形式に変換
  const seenIsbns = new Set(localResults.map((r) => r.isbn).filter(Boolean));
  const externalMapped: BookSearchResult[] = externalResults
    .filter((r) => {
      if (r.isbn && seenIsbns.has(r.isbn)) return false;
      if (r.isbn) seenIsbns.add(r.isbn);
      return true;
    })
    .map((r) => {
      const matchScore = getMatchScore(normalizedQuery, r.title, r.author);
      return {
        ...r,
        bookDbId: null,
        customRank: 0,
        publisherTier: "C",
        readingCount: 0,
        completedCount: 0,
        eventCount: 0,
        _matchScore: matchScore,
        _finalScore: matchScore * 3, // customRankなし、matchScoreのみ
      };
    });

  const allResults = [...localResults, ...externalMapped];
  allResults.sort((a, b) => b._finalScore - a._finalScore);
  return allResults.slice(0, 30);
}
