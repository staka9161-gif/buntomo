// ============================================================
// メタサーチ型書籍検索API
// 複数の外部検索エンジンの結果をRRFで統合するメタサーチ戦略
// ============================================================

import { metaSearch, type MetaSearchResult } from "./search/meta-search";
import type { RankedBook } from "./search/rrf";

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
  bookDbId: string | null;
  customRank: number;
  publisherTier: string;
  readingCount: number;
  completedCount: number;
  eventCount: number;
  _matchScore: number;
  _finalScore: number;
  _sources: string[];
}

export interface SearchResult {
  books: BookSearchResult[];
  meta: {
    sourcesUsed: string[];
    cacheHit: boolean;
    tookMs: number;
  };
}

/**
 * メタサーチ型書籍検索
 */
export async function searchBooks(query: string): Promise<SearchResult> {
  const result = await metaSearch(query);
  const books = await enrichWithDbData(result.books);
  return {
    books,
    meta: result.meta,
  };
}

/**
 * RankedBook[] にDB情報（readingCount, bookDbId等）を付与
 */
async function enrichWithDbData(ranked: RankedBook[]): Promise<BookSearchResult[]> {
  // ISBN一覧でDB書籍を一括取得
  const isbns = ranked.map((r) => r.isbn).filter(Boolean) as string[];

  let dbBookMap = new Map<string, {
    id: string;
    customRank: number;
    publisherTier: string;
    readings: { status: string }[];
  }>();

  if (isbns.length > 0) {
    const { prisma } = await import("./db");
    const dbBooks = await prisma.book.findMany({
      where: { isbn: { in: isbns } },
      select: {
        id: true,
        isbn: true,
        customRank: true,
        publisherTier: true,
        readings: { select: { status: true } },
      },
    });
    dbBookMap = new Map(dbBooks.map((b) => [b.isbn!, b]));
  }

  return ranked.map((r) => {
    const dbBook = r.isbn ? dbBookMap.get(r.isbn) : undefined;
    return {
      isbn: r.isbn,
      title: r.title,
      author: r.author,
      publisher: r.publisher,
      label: r.label,
      publishedDate: r.publishedDate,
      totalPages: r.totalPages,
      coverImageUrl: r.coverImageUrl,
      description: r.description,
      bookDbId: dbBook?.id || null,
      customRank: dbBook?.customRank || 0,
      publisherTier: dbBook?.publisherTier || "C",
      readingCount: dbBook?.readings.filter((rd) => rd.status === "READING").length || 0,
      completedCount: dbBook?.readings.filter((rd) => rd.status === "COMPLETED").length || 0,
      eventCount: 0,
      _matchScore: 0,
      _finalScore: r._finalScore,
      _sources: r._sources,
    };
  });
}
