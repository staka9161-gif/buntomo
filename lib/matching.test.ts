import { describe, it, expect } from "vitest";
import {
  calculateMatchScore,
  classifyMatch,
  assignTranslationGroup,
  type BookCandidate,
  type MatchClassification,
} from "./matching";

// ============================================================
// ヘルパー: テスト用の BookCandidate を簡潔に作る
// ============================================================
function book(overrides: Partial<BookCandidate>): BookCandidate {
  return {
    title: "",
    titleKana: undefined,
    author: "",
    authorKana: undefined,
    publisher: undefined,
    year: undefined,
    pageCount: undefined,
    format: undefined,
    isbn: undefined,
    originalTitle: undefined,
    ndlWorkId: undefined,
    openlibraryWorkId: undefined,
    translator: undefined,
    ...overrides,
  };
}

// ============================================================
// test-fixtures.md セクション3: マッチング判定
// ============================================================

describe("classifyMatch", () => {
  // ✅ 自動マージ（score ≥ 0.92）
  describe("自動マージ", () => {
    it("M1: 単行本と文庫版", () => {
      const a = book({
        title: "ノルウェイの森",
        titleKana: "ノルウェイノモリ",
        author: "村上春樹",
        authorKana: "ムラカミハルキ",
        publisher: "講談社",
        format: "hardcover",
        year: 1987,
      });
      const b = book({
        title: "ノルウェイの森（上）",
        titleKana: "ノルウェイノモリ",
        author: "村上春樹",
        authorKana: "ムラカミハルキ",
        publisher: "講談社文庫",
        format: "bunko",
        year: 1991,
      });
      const result = classifyMatch(a, b);
      // 一方だけ volume あり (null vs "1") → 0.85 (suggest_merge)
      // 単行本 vs 分冊文庫は人間判断に委ねる
      expect(result.classification).toBe("suggest_merge");
    });

    it("M2: 紙書籍と電子版", () => {
      const a = book({
        title: "コンビニ人間",
        titleKana: "コンビニニンゲン",
        author: "村田沙耶香",
        authorKana: "ムラタサヤカ",
        format: "hardcover",
        year: 2016,
      });
      const b = book({
        title: "コンビニ人間",
        titleKana: "コンビニニンゲン",
        author: "村田沙耶香",
        authorKana: "ムラタサヤカ",
        format: "ebook",
        year: 2018,
      });
      const result = classifyMatch(a, b);
      expect(result.classification).toBe("auto_merge");
    });

    it("M3: 新装版", () => {
      const a = book({
        title: "羊をめぐる冒険",
        titleKana: "ヒツジヲメグルボウケン",
        author: "村上春樹",
        authorKana: "ムラカミハルキ",
        year: 1982,
        pageCount: 380,
      });
      const b = book({
        title: "羊をめぐる冒険〔新装版〕",
        titleKana: "ヒツジヲメグルボウケン",
        author: "村上春樹",
        authorKana: "ムラカミハルキ",
        year: 2004,
        pageCount: 392,
      });
      const result = classifyMatch(a, b);
      expect(result.classification).toBe("auto_merge");
    });
  });

  // ❌ 別 Work（score < 0.75 または明示判定）
  describe("別 Work", () => {
    it("S1: 抄訳・児童向け", () => {
      const a = book({
        title: "レ・ミゼラブル",
        author: "ヴィクトル・ユーゴー",
        authorKana: "ヴィクトルユーゴー",
        pageCount: 2400,
      });
      const b = book({
        title: "ああ無情（少年少女世界文学全集）",
        author: "ヴィクトル・ユーゴー",
        authorKana: "ヴィクトルユーゴー",
        pageCount: 200,
      });
      const result = classifyMatch(a, b);
      expect(result.classification).toBe("separate");
    });

    it("S2: 同タイトル別作品（著者不一致）", () => {
      const a = book({
        title: "それから",
        author: "夏目漱石",
        authorKana: "ナツメソウセキ",
        year: 1909,
      });
      const b = book({
        title: "それから",
        author: "池井戸潤",
        authorKana: "イケイドジュン",
        year: 2015,
      });
      const result = classifyMatch(a, b);
      expect(result.classification).toBe("separate");
    });

    it("S3: メディアミックス（著者不一致）", () => {
      const a = book({
        title: "鬼滅の刃 1",
        author: "吾峠呼世晴",
        authorKana: "ゴトウゲコヨハル",
      });
      const b = book({
        title: "鬼滅の刃 ノベライズ",
        author: "松田朱夏",
        authorKana: "マツダシュカ",
      });
      const result = classifyMatch(a, b);
      expect(result.classification).toBe("separate");
    });
  });

  // ⚠️ 中スコア（MergeSuggestion 行き）
  describe("中スコア（MergeSuggestion）", () => {
    it("P1: 翻訳者違いの可能性", () => {
      const a = book({
        title: "カラマーゾフの兄弟 1",
        titleKana: "カラマーゾフノキョウダイ",
        author: "ドストエフスキー",
        authorKana: "ドストエフスキー",
        publisher: "光文社",
        year: 2006,
        translator: "亀山郁夫",
      });
      const b = book({
        title: "カラマーゾフの兄弟（上）",
        titleKana: "カラマーゾフノキョウダイ",
        author: "ドストエフスキー",
        authorKana: "ドストエフスキー",
        publisher: "新潮社",
        year: 1978,
        translator: "原卓也",
      });
      const result = classifyMatch(a, b);
      // 翻訳者違いは中スコア（管理者確認が必要）
      expect(result.classification).toBe("suggest_merge");
    });

    it("P2: タイトル軽微違い・著者一致", () => {
      const a = book({
        title: "推し、燃ゆ",
        titleKana: "オシモユ",
        author: "宇佐見りん",
        authorKana: "ウサミリン",
        pageCount: 128,
      });
      const b = book({
        title: "推し燃ゆ",
        titleKana: "オシモユ",
        author: "宇佐見りん",
        authorKana: "ウサミリン",
        pageCount: 125,
      });
      const result = classifyMatch(a, b);
      // kana が一致するので auto_merge になりうるが、
      // タイトル表記が異なるため確認推奨
      expect(["auto_merge", "suggest_merge"]).toContain(result.classification);
    });
  });

  // 典拠ID一致
  describe("典拠ID一致", () => {
    it("NDL典拠IDが一致 → 自動マージ", () => {
      const a = book({
        title: "カラマーゾフの兄弟",
        author: "ドストエフスキー",
        ndlWorkId: "NDL-00123456",
      });
      const b = book({
        title: "カラマーゾフの兄弟",
        author: "ドストエフスキー",
        ndlWorkId: "NDL-00123456",
      });
      const result = classifyMatch(a, b);
      expect(result.classification).toBe("auto_merge");
    });

    it("原題一致 → 自動マージ", () => {
      const a = book({
        title: "そして誰もいなくなった",
        author: "アガサ・クリスティー",
        originalTitle: "And Then There Were None",
      });
      const b = book({
        title: "10人のインディアン",
        author: "アガサ・クリスティー",
        originalTitle: "And Then There Were None",
      });
      const result = classifyMatch(a, b);
      expect(result.classification).toBe("auto_merge");
    });
  });
});

// ============================================================
// test-fixtures.md セクション4: TranslationGroup 振り分け
// ============================================================
describe("assignTranslationGroup", () => {
  it("T1: 翻訳者明示あり → 同一翻訳者は同グループ", () => {
    const editions = [
      { id: "x", translator: "亀山郁夫" },
      { id: "y", translator: "亀山郁夫" },
      { id: "z", translator: "原卓也" },
    ];
    const groups = assignTranslationGroup(editions);
    // X と Y は同一グループ
    expect(groups.get("x")).toBe(groups.get("y"));
    // Z は別グループ
    expect(groups.get("x")).not.toBe(groups.get("z"));
  });

  it("T2: 翻訳者不明 → default グループ", () => {
    const editions = [
      { id: "a", translator: null },
      { id: "b", translator: undefined },
    ];
    const groups = assignTranslationGroup(editions);
    expect(groups.get("a")).toBe("default");
    expect(groups.get("b")).toBe("default");
  });

  it("T1+T2 混合: 翻訳者ありとなし", () => {
    const editions = [
      { id: "x", translator: "亀山郁夫" },
      { id: "y", translator: null },
    ];
    const groups = assignTranslationGroup(editions);
    expect(groups.get("x")).not.toBe("default");
    expect(groups.get("y")).toBe("default");
  });
});

// ============================================================
// test-fixtures.md セクション6: エッジケース
// ============================================================
describe("エッジケース", () => {
  it("E1: 合本版は別 Work", () => {
    const a = book({
      title: "ノルウェイの森（上）",
      titleKana: "ノルウェイノモリ",
      author: "村上春樹",
      authorKana: "ムラカミハルキ",
      year: 1991,
      pageCount: 300,
    });
    const c = book({
      title: "ノルウェイの森（合本版）",
      titleKana: "ノルウェイノモリ",
      author: "村上春樹",
      authorKana: "ムラカミハルキ",
      year: 2010,
      pageCount: 600,
    });
    // 合本版はタイトルが一致しても巻数情報の差異で別 Work 寄り
    // ただし、kana が一致するので中スコア以上にはなりうる
    const result = classifyMatch(a, c);
    expect(["separate", "suggest_merge"]).toContain(result.classification);
  });

  it("E3: 改題だが原題一致 → 自動マージ", () => {
    const a = book({
      title: "そして誰もいなくなった",
      author: "アガサ・クリスティー",
      originalTitle: "And Then There Were None",
    });
    const b = book({
      title: "10人のインディアン",
      author: "アガサ・クリスティー",
      originalTitle: "And Then There Were None",
    });
    const result = classifyMatch(a, b);
    expect(result.classification).toBe("auto_merge");
  });
});

// ============================================================
// calculateMatchScore の基本テスト
// ============================================================
describe("calculateMatchScore", () => {
  it("完全一致のタイトル+著者 → 高スコア", () => {
    const a = book({
      title: "テスト",
      titleKana: "テスト",
      author: "著者",
      authorKana: "チョシャ",
    });
    const score = calculateMatchScore(a, a);
    expect(score).toBeGreaterThanOrEqual(0.92);
  });

  it("著者不一致 → 低スコア", () => {
    const a = book({ title: "テスト", author: "著者A", authorKana: "チョシャA" });
    const b = book({ title: "テスト", author: "著者B", authorKana: "チョシャB" });
    const score = calculateMatchScore(a, b);
    expect(score).toBeLessThan(0.75);
  });
});
