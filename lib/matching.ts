// ============================================================
// Work マッチングロジック
//
// 新しい書籍データを取り込む際に、既存 Work と同一かどうかを判定する。
// instructions.md セクション4 の多段戦略を実装。
// ============================================================

import { normalizeTitle, normalizeAuthor } from "./normalize-work";

// ============================================================
// 閾値設定（運用で調整可能）
// ============================================================
export const MATCH_THRESHOLDS = {
  /** この値以上 → 自動で既存 Work に Edition として紐付け */
  autoMerge: 0.92,
  /** この値以上 autoMerge 未満 → MergeSuggestion に保留 */
  suggestMerge: 0.75,
  // suggestMerge 未満 → 新規 Work として作成
};

// ============================================================
// 型定義
// ============================================================
export interface BookCandidate {
  title: string;
  titleKana?: string;
  titleNormalized?: string;   // DB に保存済みの正規化値（あればこちらを優先）
  author: string;
  authorKana?: string;
  authorNormalized?: string;  // DB に保存済みの正規化値（あればこちらを優先）
  publisher?: string;
  year?: number;
  pageCount?: number;
  format?: string;
  isbn?: string;
  originalTitle?: string;
  ndlWorkId?: string;
  openlibraryWorkId?: string;
  translator?: string;
}

export type MatchClassificationType = "auto_merge" | "suggest_merge" | "separate";

export interface MatchClassification {
  classification: MatchClassificationType;
  score: number;
  reason: string;
}

// ============================================================
// 文字列類似度: Levenshtein 距離ベースの正規化スコア
// ============================================================
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // メモリ効率のため 2 行だけ使う
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // 削除
        curr[j - 1] + 1,  // 挿入
        prev[j - 1] + cost // 置換
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// ============================================================
// 文字 n-gram Jaccard 類似度
// ============================================================
function charNgrams(str: string, n: number): Set<string> {
  const ngrams = new Set<string>();
  for (let i = 0; i <= str.length - n; i++) {
    ngrams.add(str.slice(i, i + n));
  }
  return ngrams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function ngramJaccardSimilarity(a: string, b: string, n: number = 2): number {
  return jaccardSimilarity(charNgrams(a, n), charNgrams(b, n));
}

// ============================================================
// タイトル類似度（Levenshtein + n-gram Jaccard の加重平均）
// ============================================================
function titleSimilarity(a: string, b: string): number {
  const lev = levenshteinSimilarity(a, b);
  const jaccard = ngramJaccardSimilarity(a, b, 2);
  // Levenshtein 重み 0.6、Jaccard 重み 0.4
  return lev * 0.6 + jaccard * 0.4;
}

// ============================================================
// 出版年近接度
// ============================================================
function yearProximity(yearA?: number, yearB?: number): number {
  if (yearA == null || yearB == null) return 0.5; // 不明時は中立
  const diff = Math.abs(yearA - yearB);
  if (diff <= 3) return 1.0;
  if (diff <= 10) return 0.8;
  if (diff <= 20) return 0.5;
  return 0.3;
}

// ============================================================
// ページ数近接度
// ============================================================
function pageCountProximity(pagesA?: number, pagesB?: number): number {
  if (pagesA == null || pagesB == null || pagesA === 0 || pagesB === 0) return 0.5;
  const ratio = Math.min(pagesA, pagesB) / Math.max(pagesA, pagesB);
  if (ratio >= 0.8) return 1.0;  // ±20% 以内
  if (ratio >= 0.5) return 0.5;  // ±50% 以内
  return 0.0;                    // 大幅差（抄訳等の可能性）
}

// ============================================================
// 新装版等の修飾語を除去
// ============================================================
function removeEditionModifiers(title: string): string {
  return title
    .replace(/[〔\[【（(][^〕\]】）)]*(?:新装|改訂|増補|愛蔵|完全|決定|普及|ワイド|合本)[^〕\]】）)]*[〕\]】）)]/g, "")
    .trim();
}

// ============================================================
// calculateMatchScore: 2つの BookCandidate 間のマッチングスコア
// ============================================================
export function calculateMatchScore(a: BookCandidate, b: BookCandidate): number {
  // --- 1. 典拠ID一致チェック（最高優先度） ---
  if (a.ndlWorkId && b.ndlWorkId && a.ndlWorkId === b.ndlWorkId) return 1.0;
  if (a.openlibraryWorkId && b.openlibraryWorkId && a.openlibraryWorkId === b.openlibraryWorkId) return 1.0;
  if (a.originalTitle && b.originalTitle) {
    const normA = normalizeTitle(a.originalTitle);
    const normB = normalizeTitle(b.originalTitle);
    if (normA.normalized === normB.normalized && normA.normalized.length > 0) return 1.0;
  }

  // --- 2. 著者名の正規化と比較 ---
  // DB に保存済みの正規化値があればそちらを優先（parseAuthorField 適用済み）
  // なければ実行時に計算（既存テストとの後方互換性維持）
  const authorA = (a.authorNormalized && a.authorNormalized.length > 0)
    ? a.authorNormalized
    : normalizeAuthor(a.author, a.authorKana);
  const authorB = (b.authorNormalized && b.authorNormalized.length > 0)
    ? b.authorNormalized
    : normalizeAuthor(b.author, b.authorKana);
  const authorMatch = authorA === authorB;

  // 著者不一致は大きなペナルティ（基本的に別 Work）
  if (!authorMatch) {
    const authorSim = titleSimilarity(authorA, authorB);
    // 著者名が大きく異なる → 早期に別 Work 判定
    if (authorSim < 0.8) return 0.1;
    // 著者名が類似してる場合（表記ゆれの可能性）でも上限を設ける
    return Math.min(0.7, authorSim * 0.5);
  }

  // --- 3. タイトルの正規化と比較 ---
  // titleNormalized は volume/subtitle 分離が必要なため normalizeTitle を呼ぶ
  // （DB の titleNormalized は volume 除去済みの文字列のみで、volume 情報を持たない）
  const titleNormA = normalizeTitle(a.title, a.titleKana);
  const titleNormB = normalizeTitle(b.title, b.titleKana);

  // 新装版等の修飾語を除去してからも比較
  const cleanTitleA = removeEditionModifiers(titleNormA.normalized);
  const cleanTitleB = removeEditionModifiers(titleNormB.normalized);

  // 正規化完全一致チェック
  if (cleanTitleA === cleanTitleB && authorMatch) {
    // 巻数が異なる場合は別 Work
    if (titleNormA.volume !== titleNormB.volume &&
        titleNormA.volume != null && titleNormB.volume != null) {
      return 0.3;
    }
    // 一方だけ巻数あり
    if (titleNormA.volume !== titleNormB.volume &&
        (titleNormA.volume != null || titleNormB.volume != null)) {
      // 「合本版」と明記されている場合 → 中スコア
      const hasGapponLabel = a.title.includes("合本") || b.title.includes("合本");
      if (hasGapponLabel) return 0.85;
      // それ以外（単行本 vs 分冊文庫等）→ 同一 Work の別 Edition
      // （例: "ノルウェイの森" と "ノルウェイの森（上）"）
      return 0.95;
    }
    // 翻訳者が異なる → 中スコア（同一 Work + 別 TranslationGroup として保留）
    if (a.translator && b.translator && a.translator !== b.translator) {
      return 0.88;
    }
    return 0.98; // ほぼ確実に同一 Work
  }

  // --- 4. スコアベース類似度 ---
  const titleSim = titleSimilarity(cleanTitleA, cleanTitleB);
  const yearSim = yearProximity(a.year, b.year);
  const pageSim = pageCountProximity(a.pageCount, b.pageCount);

  // 巻数の違いによるペナルティ
  let volumePenalty = 0;
  if (titleNormA.volume !== titleNormB.volume) {
    if (titleNormA.volume != null && titleNormB.volume != null) {
      // 両方巻数あり、かつ異なる → 別巻（＝別 Work）
      volumePenalty = -0.5;
    }
    // 一方だけ巻数あり → 中程度のペナルティ（合本版 vs 分冊等）
    if ((titleNormA.volume == null) !== (titleNormB.volume == null)) {
      volumePenalty = -0.2;
    }
  }

  // 翻訳者の違い: 中スコア帯に落とすペナルティ
  // 翻訳者が異なる場合は読者体験が大きく異なるため、管理者確認を促す
  let translatorPenalty = 0;
  if (a.translator && b.translator && a.translator !== b.translator) {
    translatorPenalty = -0.15;
  }

  // 重み付き合計
  const weights = {
    title: 0.45,
    author: 0.30,
    year: 0.10,
    page: 0.15,
  };

  const authorScore = authorMatch ? 1.0 : titleSimilarity(authorA, authorB);

  const rawScore =
    titleSim * weights.title +
    authorScore * weights.author +
    yearSim * weights.year +
    pageSim * weights.page +
    volumePenalty +
    translatorPenalty;

  return Math.max(0, Math.min(1, rawScore));
}

// ============================================================
// classifyMatch: スコアに基づいて分類
// ============================================================
export function classifyMatch(a: BookCandidate, b: BookCandidate): MatchClassification {
  const score = calculateMatchScore(a, b);

  if (score >= MATCH_THRESHOLDS.autoMerge) {
    return { classification: "auto_merge", score, reason: "スコアが閾値以上" };
  }
  if (score >= MATCH_THRESHOLDS.suggestMerge) {
    return { classification: "suggest_merge", score, reason: "中スコア帯（管理者確認推奨）" };
  }
  return { classification: "separate", score, reason: "スコアが低い（別作品と判定）" };
}

// ============================================================
// assignTranslationGroup: Edition を翻訳者別にグループ分け
// ============================================================
export function assignTranslationGroup(
  editions: { id: string; translator?: string | null }[]
): Map<string, string> {
  const result = new Map<string, string>();
  const translatorToGroup = new Map<string, string>();
  let groupCounter = 0;

  for (const edition of editions) {
    const translator = edition.translator?.trim();
    if (!translator) {
      result.set(edition.id, "default");
      continue;
    }

    let groupId = translatorToGroup.get(translator);
    if (!groupId) {
      groupCounter++;
      groupId = `group_${groupCounter}`;
      translatorToGroup.set(translator, groupId);
    }
    result.set(edition.id, groupId);
  }

  return result;
}
