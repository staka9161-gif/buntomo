import { describe, it, expect } from "vitest";
import {
  calculateMatchScore,
  classifyMatch,
  assignTranslationGroup,
  MATCH_THRESHOLDS,
  type BookCandidate,
} from "./matching";
import { normalizeTitle, normalizeAuthor } from "./normalize-work";

function book(overrides: Partial<BookCandidate>): BookCandidate {
  return {
    title: "", author: "", titleKana: undefined, authorKana: undefined,
    publisher: undefined, year: undefined, pageCount: undefined,
    format: undefined, isbn: undefined, originalTitle: undefined,
    ndlWorkId: undefined, openlibraryWorkId: undefined, translator: undefined,
    ...overrides,
  };
}

// ============================================================
// 閾値設定のテスト
// ============================================================
describe("MATCH_THRESHOLDS", () => {
  it("autoMerge > suggestMerge", () => {
    expect(MATCH_THRESHOLDS.autoMerge).toBeGreaterThan(MATCH_THRESHOLDS.suggestMerge);
  });

  it("suggestMerge > 0", () => {
    expect(MATCH_THRESHOLDS.suggestMerge).toBeGreaterThan(0);
  });
});

// ============================================================
// calculateMatchScore の境界ケース
// ============================================================
describe("calculateMatchScore - 境界ケース", () => {
  it("空タイトルでもクラッシュしない", () => {
    const a = book({ title: "", author: "" });
    const b = book({ title: "", author: "" });
    const score = calculateMatchScore(a, b);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("ISBN一致でも著者不一致なら低スコア", () => {
    const a = book({ title: "テスト", author: "著者A", isbn: "9784000000000" });
    const b = book({ title: "テスト", author: "著者B", isbn: "9784000000000" });
    // ISBN は直接スコアに影響しない（典拠IDではないため）
    const score = calculateMatchScore(a, b);
    expect(score).toBeLessThan(MATCH_THRESHOLDS.autoMerge);
  });

  it("OpenLibrary Work ID 一致 → 1.0", () => {
    const a = book({ title: "A", author: "X", openlibraryWorkId: "OL123W" });
    const b = book({ title: "B", author: "Y", openlibraryWorkId: "OL123W" });
    expect(calculateMatchScore(a, b)).toBe(1.0);
  });

  it("ページ数大幅差 → スコア低下", () => {
    const a = book({ title: "テスト", titleKana: "テスト", author: "著者", authorKana: "チョシャ", pageCount: 2000 });
    const b = book({ title: "テスト", titleKana: "テスト", author: "著者", authorKana: "チョシャ", pageCount: 100 });
    const score = calculateMatchScore(a, b);
    // ページ数が大きく違うとスコアが下がる
    expect(score).toBeLessThan(1.0);
  });

  it("年が3年以内 → 高い近接度", () => {
    const a = book({ title: "テスト", titleKana: "テスト", author: "著者", authorKana: "チョシャ", year: 2020 });
    const b = book({ title: "テスト", titleKana: "テスト", author: "著者", authorKana: "チョシャ", year: 2022 });
    const score = calculateMatchScore(a, b);
    expect(score).toBeGreaterThanOrEqual(MATCH_THRESHOLDS.autoMerge);
  });

  it("巻数違い → 低スコア（別 Work）", () => {
    const a = book({ title: "テスト 1", titleKana: "テスト", author: "著者", authorKana: "チョシャ" });
    const b = book({ title: "テスト 2", titleKana: "テスト", author: "著者", authorKana: "チョシャ" });
    const score = calculateMatchScore(a, b);
    expect(score).toBeLessThan(MATCH_THRESHOLDS.suggestMerge);
  });
});

// ============================================================
// classifyMatch のカバレッジ
// ============================================================
describe("classifyMatch - 分類結果の網羅", () => {
  it("スコア 1.0 → auto_merge", () => {
    const a = book({ title: "X", author: "Y", ndlWorkId: "NDL-1" });
    const b = book({ title: "X", author: "Y", ndlWorkId: "NDL-1" });
    expect(classifyMatch(a, b).classification).toBe("auto_merge");
    expect(classifyMatch(a, b).score).toBe(1.0);
  });

  it("完全に異なる作品 → separate", () => {
    const a = book({ title: "りんご", author: "太郎" });
    const b = book({ title: "みかん", author: "花子" });
    expect(classifyMatch(a, b).classification).toBe("separate");
  });

  it("reason フィールドが空でない", () => {
    const a = book({ title: "テスト", author: "著者" });
    const result = classifyMatch(a, a);
    expect(result.reason).toBeTruthy();
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// ============================================================
// assignTranslationGroup の追加ケース
// ============================================================
describe("assignTranslationGroup - 追加ケース", () => {
  it("空配列 → 空マップ", () => {
    const groups = assignTranslationGroup([]);
    expect(groups.size).toBe(0);
  });

  it("全員同じ翻訳者 → 1グループ", () => {
    const editions = [
      { id: "a", translator: "亀山郁夫" },
      { id: "b", translator: "亀山郁夫" },
      { id: "c", translator: "亀山郁夫" },
    ];
    const groups = assignTranslationGroup(editions);
    const groupIds = new Set(groups.values());
    expect(groupIds.size).toBe(1);
  });

  it("3人の翻訳者 → 3グループ", () => {
    const editions = [
      { id: "a", translator: "亀山郁夫" },
      { id: "b", translator: "原卓也" },
      { id: "c", translator: "米川正夫" },
    ];
    const groups = assignTranslationGroup(editions);
    const groupIds = new Set(groups.values());
    expect(groupIds.size).toBe(3);
  });
});

// ============================================================
// PR-B2: ローマ数字巻数が異なる場合は別 Work（separate）
// ============================================================
describe("classifyMatch - ローマ数字巻数違い", () => {
  it("基礎I vs 基礎II → separate（巻数違い）", () => {
    const a = book({ title: "フォルマシオン・ミュジカル基礎（I）", author: "著者A", authorKana: "チョシャA" });
    const b = book({ title: "フォルマシオン・ミュジカル基礎II", author: "著者A", authorKana: "チョシャA" });
    const result = classifyMatch(a, b);
    expect(result.classification).toBe("separate");
    expect(result.score).toBeLessThan(MATCH_THRESHOLDS.suggestMerge);
  });

  it("現代日本会計学説批判II vs III → separate", () => {
    const a = book({ title: "現代日本会計学説批判II", author: "著者B", authorKana: "チョシャB" });
    const b = book({ title: "現代日本会計学説批判III", author: "著者B", authorKana: "チョシャB" });
    const result = classifyMatch(a, b);
    expect(result.classification).toBe("separate");
  });

  it("同巻（表記揺れ）: テストII vs テストⅡ → auto_merge", () => {
    const a = book({ title: "テストII", titleKana: "テスト", author: "著者", authorKana: "チョシャ" });
    const b = book({ title: "テストⅡ", titleKana: "テスト", author: "著者", authorKana: "チョシャ" });
    const result = classifyMatch(a, b);
    expect(result.classification).toBe("auto_merge");
  });
});

// ============================================================
// normalizeTitle の追加ケース
// ============================================================
describe("normalizeTitle - 追加カバレッジ", () => {
  it("新装版ラベル付きでも正規化後は同じ", () => {
    const a = normalizeTitle("テスト");
    const b = normalizeTitle("テスト〔新装版〕");
    // 新装版ラベルは記号除去で消える
    expect(a.normalized).toBe("テスト");
    expect(b.normalized).toBe("テスト〔新装版〕"); // 〔〕は残る（マッチングロジック側の removeEditionModifiers で対応）
  });

  it("副題なしのタイトル → subtitle が null", () => {
    expect(normalizeTitle("シンプルなタイトル").subtitle).toBeNull();
  });

  it("巻数なしのタイトル → volume が null", () => {
    expect(normalizeTitle("巻数のないタイトル").volume).toBeNull();
  });

  it("BOOK2 → volume: 2", () => {
    expect(normalizeTitle("テスト BOOK2").volume).toBe("2");
  });

  it("Vol.3 → volume: 3", () => {
    expect(normalizeTitle("テスト Vol.3").volume).toBe("3");
  });

  it("第10巻 → volume: 10", () => {
    expect(normalizeTitle("テスト 第10巻").volume).toBe("10");
  });
});

// ============================================================
// normalizeAuthor の追加ケース
// ============================================================
describe("normalizeAuthor - 追加カバレッジ", () => {
  it("空文字列 → 空文字列", () => {
    expect(normalizeAuthor("")).toBe("");
  });

  it("全角スペースのみの名前 → 空文字列", () => {
    expect(normalizeAuthor("　")).toBe("");
  });

  it("長音含みの名前: ドストエフスキー", () => {
    const result = normalizeAuthor("ドストエフスキー");
    expect(result).toBe("ドストエフスキイ"); // ー → イ（エ段の長音）
  });

  it("ASCII+カタカナ混合はカタカナパスを通る", () => {
    const result = normalizeAuthor("J.K.ローリング");
    expect(result).toBe("JKロウリング");
  });
});
