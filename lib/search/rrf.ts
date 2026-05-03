// ============================================================
// Reciprocal Rank Fusion (RRF) + 最終スコア計算
// 複数検索エンジンのランキングを統合する実証済みアルゴリズム
// ============================================================

import { getPublisherTierAndScore } from "../ranking/publisher-tiers";

export interface RRFInput {
  source: string;
  books: RRFBook[];
  weight: number;
}

export interface RRFBook {
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  label: string | null;
  publishedDate: string | null;
  totalPages: number;
  coverImageUrl: string | null;
  description: string | null;
  reviewCount?: number;
  reviewAverage?: number;
}

export interface RankedBook extends RRFBook {
  _rrfScore: number;
  _sources: string[];
  _finalScore: number;
  _bonusDetail: {
    rrfBase: number;
    multiSourceBonus: number;
    publisherBonus: number;
    completenessBonus: number;
    penalty: number;
  };
}

/**
 * 書籍の統合キーを生成（ISBN優先、なければタイトル+著者の正規化キー）
 */
function bookKey(book: RRFBook): string {
  if (book.isbn) return book.isbn;
  const t = book.title.replace(/\s+/g, "").toLowerCase();
  const a = book.author.replace(/\s+/g, "").toLowerCase();
  return `${t}::${a}`;
}

/**
 * 2冊の書誌情報をマージ（より完全な情報を採用）
 */
function mergeBooks(existing: RRFBook, incoming: RRFBook): RRFBook {
  return {
    isbn: existing.isbn || incoming.isbn,
    title: existing.title.length >= incoming.title.length ? existing.title : incoming.title,
    author: existing.author !== "不明" ? existing.author : incoming.author,
    publisher: existing.publisher || incoming.publisher,
    label: existing.label || incoming.label,
    publishedDate: existing.publishedDate || incoming.publishedDate,
    totalPages: existing.totalPages > 0 ? existing.totalPages : incoming.totalPages,
    coverImageUrl: existing.coverImageUrl || incoming.coverImageUrl,
    description: existing.description || incoming.description,
    reviewCount: Math.max(existing.reviewCount ?? 0, incoming.reviewCount ?? 0),
    reviewAverage: existing.reviewAverage || incoming.reviewAverage,
  };
}

const K = 60; // RRF定数

/**
 * Reciprocal Rank Fusion
 * 各ソースのランキングをRRFスコアで統合
 */
export function reciprocalRankFusion(inputs: RRFInput[]): RankedBook[] {
  const scoreMap = new Map<string, { book: RRFBook; score: number; sources: string[] }>();

  for (const { source, books, weight } of inputs) {
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      const key = bookKey(book);
      const rank = i + 1;
      const rrfScore = weight / (K + rank);

      const entry = scoreMap.get(key);
      if (entry) {
        entry.score += rrfScore;
        entry.sources.push(source);
        entry.book = mergeBooks(entry.book, book);
      } else {
        scoreMap.set(key, { book: { ...book }, score: rrfScore, sources: [source] });
      }
    }
  }

  return Array.from(scoreMap.values())
    .map(({ book, score, sources }) => {
      // ユニークソース数
      const uniqueSources = [...new Set(sources)];
      const sourceCount = uniqueSources.length;

      // 複数ソースヒットボーナス
      const multiSourceBonus =
        sourceCount >= 4 ? 30 :
        sourceCount >= 3 ? 15 :
        sourceCount >= 2 ? 5 : 0;

      // レーベル/出版社加点
      const { tier } = getPublisherTierAndScore(book.publisher, book.label);
      const publisherBonus =
        tier === "S" ? 20 :
        tier === "A" ? 10 : 0;

      // 書誌完成度
      let completenessBonus = 0;
      if (book.totalPages > 0) completenessBonus += 2;
      if (book.coverImageUrl) completenessBonus += 2;
      if (book.description) completenessBonus += 1;

      // ペナルティ（電子版・完全版等）
      let penalty = 0;
      const titleLower = book.title.toLowerCase();
      if (/電子|kindle|kobo/i.test(titleLower)) penalty += 10;
      if (/完全版|愛蔵版|豪華版|限定版/.test(book.title)) penalty += 3;

      const finalScore =
        score * 100
        + multiSourceBonus
        + publisherBonus
        + completenessBonus
        - penalty;

      return {
        ...book,
        _rrfScore: score,
        _sources: uniqueSources,
        _finalScore: finalScore,
        _bonusDetail: {
          rrfBase: Math.round(score * 100 * 100) / 100,
          multiSourceBonus,
          publisherBonus,
          completenessBonus,
          penalty,
        },
      } as RankedBook;
    })
    .sort((a, b) => b._finalScore - a._finalScore);
}
