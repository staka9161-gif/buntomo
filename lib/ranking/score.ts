// ============================================================
// 検索時のタイトル・著者マッチスコア計算
// custom_rank(事前計算) + matchScore(検索時計算) で最終順位を決定
// ============================================================

import {
  normalizeText,
  katakanaToHiragana,
  removeSymbols,
} from "../normalize";

/**
 * クエリとのタイトル・著者マッチスコア（0〜30）
 * custom_rankに加算して最終ソートに使う
 */
export function getMatchScore(
  query: string,
  title: string,
  author: string,
): number {
  const nq = removeSymbols(normalizeText(query)).toLowerCase();
  const nqH = katakanaToHiragana(nq);

  const nt = removeSymbols(normalizeText(title)).toLowerCase();
  const ntH = katakanaToHiragana(nt);

  const na = removeSymbols(normalizeText(author)).toLowerCase();
  const naH = katakanaToHiragana(na);

  let score = 0;

  // タイトルマッチ
  if (nt === nq || ntH === nqH) {
    score += 30; // 完全一致
  } else if (nt.startsWith(nq) || ntH.startsWith(nqH)) {
    score += 20; // 前方一致
  } else if (nt.includes(nq) || ntH.includes(nqH)) {
    score += 10; // 部分一致
  } else {
    // トークン単位
    const tokens = nq.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      const matched = tokens.filter(
        (t) => nt.includes(t) || ntH.includes(t) || ntH.includes(katakanaToHiragana(t))
      );
      score += Math.round((matched.length / tokens.length) * 10);
    }
  }

  // 巻数のみ差分ボーナス
  if (score < 30) {
    const volumePattern = /\s*[上下前後]巻?$|\s*[（(]\d+[）)]$|\s*\d+$/;
    const titleWithoutVolume = nt.replace(volumePattern, "").trim();
    if (titleWithoutVolume === nq || katakanaToHiragana(titleWithoutVolume) === nqH) {
      score = Math.max(score, 25);
    }
  }

  // 著者名一致ボーナス
  if (
    na.includes(nq) || naH.includes(nqH) ||
    nq.split(/\s+/).some((t) => na.includes(t) || naH.includes(katakanaToHiragana(t)))
  ) {
    score += 10;
  }

  return Math.min(score, 30);
}
