// ============================================================
// メタサーチオーケストレーター
// キャッシュ → ローカルDB → 外部API並列 → RRF統合 → キャッシュ保存
// ============================================================

import { prisma } from "../db";
import { normalizeText, removeSymbols, katakanaToHiragana } from "../normalize";
import { reciprocalRankFusion, type RRFInput, type RRFBook, type RankedBook } from "./rrf";
import {
  searchLocalDb,
  searchRakutenEnhanced,
  searchGoogleBooks,
  searchNdl,
  upsertExternalResults,
  type ExternalBookData,
} from "./adapters";
import crypto from "crypto";

// ============================================================
// ソースの重み付け
// ============================================================
const SOURCE_WEIGHTS = {
  rakuten_keyword: 1.2,
  rakuten_title: 1.4,
  rakuten_author: 1.1,
  google: 1.0,
  ndl: 0.8,
  local: 0.5,
};

// ============================================================
// キャッシュ
// ============================================================
function queryHash(query: string): string {
  return crypto.createHash("sha256").update(query).digest("hex").slice(0, 64);
}

async function getCachedResults(normalizedQuery: string): Promise<RankedBook[] | null> {
  try {
    const hash = queryHash(normalizedQuery);
    const cached = await prisma.searchCache.findUnique({ where: { queryHash: hash } });
    if (!cached || cached.expiresAt < new Date()) {
      if (cached) {
        prisma.searchCache.delete({ where: { queryHash: hash } }).catch(() => {});
      }
      return null;
    }
    // ISBNリストからDB書籍を復元
    const isbns = cached.resultIsbns;
    const scores = cached.resultScores;
    if (isbns.length === 0) return null;

    const books = await prisma.book.findMany({
      where: { isbn: { in: isbns } },
      include: { readings: { select: { status: true } } },
    });

    const bookMap = new Map(books.map((b) => [b.isbn, b]));
    const results: RankedBook[] = [];

    for (let i = 0; i < isbns.length; i++) {
      const book = bookMap.get(isbns[i]);
      if (!book) continue;
      results.push({
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        label: book.label,
        publishedDate: book.publishedDate,
        totalPages: book.totalPages,
        coverImageUrl: book.coverImageUrl,
        description: book.description,
        _rrfScore: scores[i] || 0,
        _sources: cached.sourcesUsed,
        _finalScore: scores[i] || 0,
        _bonusDetail: { rrfBase: 0, multiSourceBonus: 0, publisherBonus: 0, completenessBonus: 0, penalty: 0 },
      });
    }

    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

async function saveCacheResults(
  normalizedQuery: string,
  rawQuery: string,
  results: RankedBook[],
  sourcesUsed: string[],
): Promise<void> {
  try {
    const hash = queryHash(normalizedQuery);
    const isbns = results.filter((r) => r.isbn).map((r) => r.isbn!);
    const scores = results.filter((r) => r.isbn).map((r) => r._finalScore);
    const ttlMinutes = isbns.length >= 10 ? 60 : 15;

    await prisma.searchCache.upsert({
      where: { queryHash: hash },
      create: {
        queryHash: hash,
        queryRaw: rawQuery,
        queryNormalized: normalizedQuery,
        resultIsbns: isbns,
        resultScores: scores,
        sourcesUsed,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
      update: {
        resultIsbns: isbns,
        resultScores: scores,
        sourcesUsed,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    });
  } catch {
    // キャッシュ保存失敗は無視
  }
}

// ============================================================
// 学習シグナルによるブースト取得
// ============================================================
async function getLearnedBoosts(normalizedQuery: string): Promise<Map<string, number>> {
  try {
    const signals = await prisma.learningSignal.groupBy({
      by: ["isbn"],
      where: {
        queryNormalized: normalizedQuery,
        isbn: { not: null },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      _count: { action: true },
      _sum: {},
    });

    const boosts = new Map<string, number>();
    for (const s of signals) {
      if (s.isbn) {
        boosts.set(s.isbn, s._count.action * 2);
      }
    }
    return boosts;
  } catch {
    return new Map();
  }
}

// ============================================================
// メタサーチ メインフロー
// ============================================================
export interface MetaSearchResult {
  books: RankedBook[];
  meta: {
    sourcesUsed: string[];
    cacheHit: boolean;
    tookMs: number;
  };
}

export async function metaSearch(rawQuery: string): Promise<MetaSearchResult> {
  const start = Date.now();
  const normalizedQuery = removeSymbols(normalizeText(rawQuery)).toLowerCase();
  const normalizedQueryH = katakanaToHiragana(normalizedQuery);

  // 1. キャッシュチェック
  const cached = await getCachedResults(normalizedQuery);
  if (cached && cached.length >= 5) {
    return {
      books: cached.slice(0, 30),
      meta: {
        sourcesUsed: cached[0]?._sources || [],
        cacheHit: true,
        tookMs: Date.now() - start,
      },
    };
  }

  // 2. ローカルDB + 外部APIを並列実行
  const [localResults, rakutenResults, googleResults, ndlResults] = await Promise.all([
    searchLocalDb(rawQuery),
    searchRakutenEnhanced(rawQuery),
    searchGoogleBooks(rawQuery),
    searchNdl(rawQuery),
  ]);

  const sourcesUsed: string[] = ["local"];

  // 3. RRF入力を構築
  const rrfInputs: RRFInput[] = [];

  // ローカルDB結果（既にスコア順）
  if (localResults.length > 0) {
    rrfInputs.push({
      source: "local",
      books: localResults,
      weight: SOURCE_WEIGHTS.local,
    });
  }

  // 楽天（複数パターン結果）
  for (const r of rakutenResults) {
    if (r.books.length > 0) {
      rrfInputs.push(r);
      sourcesUsed.push(r.source);
    }
  }

  // Google Books
  if (googleResults.length > 0) {
    rrfInputs.push({
      source: "google",
      books: googleResults,
      weight: SOURCE_WEIGHTS.google,
    });
    sourcesUsed.push("google");
  }

  // NDL
  if (ndlResults.length > 0) {
    rrfInputs.push({
      source: "ndl",
      books: ndlResults,
      weight: SOURCE_WEIGHTS.ndl,
    });
    sourcesUsed.push("ndl");
  }

  // 4. RRF統合
  let ranked = reciprocalRankFusion(rrfInputs);

  // 5. 学習シグナルによるブースト
  const boosts = await getLearnedBoosts(normalizedQuery);
  if (boosts.size > 0) {
    ranked = ranked.map((book) => {
      const boost = book.isbn ? (boosts.get(book.isbn) ?? 0) : 0;
      return {
        ...book,
        _finalScore: book._finalScore + boost,
      };
    });
    ranked.sort((a, b) => b._finalScore - a._finalScore);
  }

  // 6. 外部結果をDBにUpsert（バックグラウンド）
  const allExternal: ExternalBookData[] = [
    ...rakutenResults.flatMap((r) => r.books),
    ...googleResults,
    ...ndlResults,
  ];
  if (allExternal.length > 0) {
    upsertExternalResults(allExternal);
  }

  // 7. キャッシュ保存（バックグラウンド）
  const top30 = ranked.slice(0, 30);
  saveCacheResults(normalizedQuery, rawQuery, top30, sourcesUsed);

  return {
    books: top30,
    meta: {
      sourcesUsed: [...new Set(sourcesUsed)],
      cacheHit: false,
      tookMs: Date.now() - start,
    },
  };
}
