// ============================================================
// メタサーチオーケストレーター
// 戦略: 自社DB十分 → 即返却 / 不十分 → 外部API並列 → RRF統合
// ============================================================

import { prisma } from "../db";
import { normalizeText, removeSymbols, katakanaToHiragana } from "../normalize";
import { getMatchScore } from "../ranking/score";
import { reciprocalRankFusion, type RRFInput, type RankedBook } from "./rrf";
import {
  searchLocalDb,
  searchRakutenEnhanced,
  searchGoogleBooks,
  searchNdl,
  upsertExternalResults,
  enrichPagesFromOpenBD,
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
  local: 1.0, // ローカルDBはデータ品質にばらつきがあるため他ソースと同等扱い
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
    const isbns = cached.resultIsbns;
    const scores = cached.resultScores;
    if (isbns.length === 0) return null;

    const books = await prisma.book.findMany({
      where: { isbn: { in: isbns } },
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
        _bonusDetail: { rrfBase: 0, multiSourceBonus: 0, publisherBonus: 0, completenessBonus: 0, popularityBonus: 0, penalty: 0 },
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
    const signals = await prisma.learningSignal.findMany({
      where: {
        queryNormalized: normalizedQuery,
        isbn: { not: null },
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
      select: { isbn: true, action: true },
    });

    if (signals.length === 0) return new Map();

    const agg = new Map<string, { clicks: number; registers: number; total: number }>();
    for (const s of signals) {
      if (!s.isbn) continue;
      const entry = agg.get(s.isbn) || { clicks: 0, registers: 0, total: 0 };
      entry.total++;
      if (s.action === "clicked") entry.clicks++;
      else entry.registers++;
      agg.set(s.isbn, entry);
    }

    const boosts = new Map<string, number>();
    for (const [isbn, { clicks, registers, total }] of agg) {
      const affinity = (clicks * 1.0 + registers * 5.0) / Math.max(total, 1);
      boosts.set(isbn, affinity);
    }
    return boosts;
  } catch {
    return new Map();
  }
}

// ============================================================
// matchScoreをRankedBookに適用
// ============================================================
function applyMatchScoreBonus(books: RankedBook[], rawQuery: string): RankedBook[] {
  const normalized = normalizeText(rawQuery);
  return books.map((book) => {
    const matchScore = getMatchScore(normalized, book.title, book.author);
    // matchScore（0-30）をfinalScoreに反映（×3で旧ロジックと同等の影響力）
    return {
      ...book,
      _finalScore: book._finalScore + matchScore * 3,
    };
  }).sort((a, b) => b._finalScore - a._finalScore);
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

  // 2. ローカル + 外部 API を全て並列実行（常に統合）
  const [localResults, rakutenResults, googleResults, ndlResults] = await Promise.all([
    searchLocalDb(rawQuery),
    searchRakutenEnhanced(rawQuery),
    searchGoogleBooks(rawQuery),
    searchNdl(rawQuery),
  ]);

  const sourcesUsed: string[] = ["local"];

  // 5. RRF入力を構築
  const rrfInputs: RRFInput[] = [];

  if (localResults.length > 0) {
    rrfInputs.push({
      source: "local",
      books: localResults,
      weight: SOURCE_WEIGHTS.local,
    });
  }

  for (const r of rakutenResults) {
    if (r.books.length > 0) {
      rrfInputs.push(r);
      sourcesUsed.push(r.source);
    }
  }

  if (googleResults.length > 0) {
    rrfInputs.push({ source: "google", books: googleResults, weight: SOURCE_WEIGHTS.google });
    sourcesUsed.push("google");
  }

  if (ndlResults.length > 0) {
    rrfInputs.push({ source: "ndl", books: ndlResults, weight: SOURCE_WEIGHTS.ndl });
    sourcesUsed.push("ndl");
  }

  // 6. RRF統合
  let ranked = reciprocalRankFusion(rrfInputs);

  // 7. matchScoreボーナスを適用（タイトル一致度をRRF結果に加算）
  ranked = applyMatchScoreBonus(ranked, rawQuery);

  // 8. 学習シグナルによるブースト
  const boosts = await getLearnedBoosts(normalizedQuery);
  if (boosts.size > 0) {
    ranked = ranked.map((book) => {
      const boost = book.isbn ? (boosts.get(book.isbn) ?? 0) : 0;
      return { ...book, _finalScore: book._finalScore + boost * 0.5 };
    });
    ranked.sort((a, b) => b._finalScore - a._finalScore);
  }

  // 9. 外部結果をDBにUpsert（バックグラウンド）
  const allExternal: ExternalBookData[] = [
    ...rakutenResults.flatMap((r) => r.books),
    ...googleResults,
    ...ndlResults,
  ];
  if (allExternal.length > 0) {
    upsertExternalResults(allExternal);
  }

  // 10. openBDでページ数補完（バックグラウンド）
  const missingPageIsbns = ranked.filter((r) => r.isbn && r.totalPages === 0).map((r) => r.isbn!);
  if (missingPageIsbns.length > 0) enrichPagesFromOpenBD(missingPageIsbns);

  // 11. キャッシュ保存
  const top30 = ranked.slice(0, 30);
  saveCacheResults(normalizedQuery, rawQuery, top30, [...new Set(sourcesUsed)]);

  return {
    books: top30,
    meta: {
      sourcesUsed: [...new Set(sourcesUsed)],
      cacheHit: false,
      tookMs: Date.now() - start,
    },
  };
}
