import { describe, it, expect } from "vitest";
import { normalizeTitle, normalizeAuthor } from "./normalize-work";

// ============================================================
// test-fixtures.md セクション1: タイトル正規化
// ============================================================
describe("normalizeTitle", () => {
  it("カタカナ化: ノルウェイの森（kana 提供時）", () => {
    const result = normalizeTitle("ノルウェイの森", "ノルウェイノモリ");
    expect(result.normalized).toBe("ノルウェイノモリ");
    expect(result.volume).toBeNull();
    expect(result.subtitle).toBeNull();
  });

  it("カタカナ化: ノルウェイの森（kana なし、ひらがなのみ変換）", () => {
    // kana なしの場合、ひらがな→カタカナは変換されるが漢字はそのまま
    const result = normalizeTitle("ノルウェイの森");
    expect(result.normalized).toBe("ノルウェイノ森");
  });

  it("巻数分離: ノルウェイの森（上）", () => {
    const result = normalizeTitle("ノルウェイの森（上）", "ノルウェイノモリ");
    expect(result.normalized).toBe("ノルウェイノモリ");
    // 上 → 1 に統一
    expect(result.volume).toBe("1");
  });

  it("表記ゆれ吸収: （上）と 上巻 で同じ結果", () => {
    const a = normalizeTitle("ノルウェイの森（上）");
    const b = normalizeTitle("ノルウェイの森 上巻");
    expect(a.normalized).toBe(b.normalized);
    expect(a.volume).toBe(b.volume);
  });

  it("全角→半角 + 巻数分離: １Ｑ８４ BOOK1", () => {
    const result = normalizeTitle("１Ｑ８４ BOOK1");
    expect(result.normalized).toBe("1Q84");
    expect(result.volume).toBe("1");
  });

  it("全角空白除去: １Ｑ８４　BOOK1", () => {
    const result = normalizeTitle("１Ｑ８４　BOOK1");
    expect(result.normalized).toBe("1Q84");
    expect(result.volume).toBe("1");
  });

  it("漢数字/算用数字/上中下を統一: カラマーゾフの兄弟", () => {
    const a = normalizeTitle("カラマーゾフの兄弟（上）");
    const b = normalizeTitle("カラマーゾフの兄弟 1");
    expect(a.normalized).toBe(b.normalized);
    // 両方 volume === "1"
    expect(a.volume).toBe(b.volume);
    expect(a.volume).toBe("1");
  });

  it("ゴミ記号・前後空白除去: となりのトトロ』 ", () => {
    const result = normalizeTitle("となりのトトロ』 ");
    expect(result.normalized).toBe("トナリノトトロ");
  });

  it("英数字は大文字統一・空白除去: Harry Potter", () => {
    const result = normalizeTitle("Harry Potter and the Philosopher's Stone");
    expect(result.normalized).toBe("HARRYPOTTERANDTHEPHILOSOPHERSSTONE");
  });

  it("中黒除去 + ひらがな→カタカナ: ハリー・ポッターと賢者の石", () => {
    // kana を提供して漢字もカタカナ化
    const result = normalizeTitle("ハリー・ポッターと賢者の石", "ハリーポッタートケンジャノイシ");
    expect(result.normalized).toBe("ハリーポッタートケンジャノイシ");
  });

  it("中黒除去（kana なし）: ハリー・ポッターと賢者の石", () => {
    const result = normalizeTitle("ハリー・ポッターと賢者の石");
    // 漢字はそのまま、ひらがな→カタカナ、中黒除去
    expect(result.normalized).toBe("ハリーポッタート賢者ノ石");
  });

  it("副題分離: 老人と海：ヘミングウェイの傑作", () => {
    const result = normalizeTitle("老人と海：ヘミングウェイの傑作", "ロウジントウミ");
    expect(result.normalized).toBe("ロウジントウミ");
    // 副題は kana に含まれないため漢字はそのまま残る
    expect(result.subtitle).toBe("ヘミングウェイノ傑作");
  });
});

// ============================================================
// test-fixtures.md セクション2: 著者名正規化
// ============================================================
describe("normalizeAuthor", () => {
  it("姓名スペースあり + kana: 村上 春樹", () => {
    expect(normalizeAuthor("村上 春樹", "ムラカミ ハルキ")).toBe("ムラカミハルキ");
  });

  it("姓名スペースなし + kana: 村上春樹", () => {
    expect(normalizeAuthor("村上春樹", "ムラカミハルキ")).toBe("ムラカミハルキ");
  });

  it("ローマ字 Last, First: Murakami, Haruki", () => {
    expect(normalizeAuthor("Murakami, Haruki")).toBe("MURAKAMIHARUKI");
  });

  it("ピリオド+カタカナ混合: J.K.ローリング", () => {
    expect(normalizeAuthor("J.K.ローリング")).toBe("JKロウリング");
  });

  it("中黒+カタカナ混合: J・K・ローリング", () => {
    expect(normalizeAuthor("J・K・ローリング")).toBe("JKロウリング");
  });

  it("ローマ字のみ: J. K. Rowling", () => {
    expect(normalizeAuthor("J. K. Rowling")).toBe("JKROWLING");
  });
});

// ============================================================
// test-fixtures.md セクション5: シリーズ巻数の正規化
// ============================================================
describe("normalizeTitle - 巻数抽出", () => {
  it("〇〇 1", () => {
    expect(normalizeTitle("テスト 1").volume).toBe("1");
  });

  it("〇〇（1）", () => {
    expect(normalizeTitle("テスト（1）").volume).toBe("1");
  });

  it("〇〇 第1巻", () => {
    expect(normalizeTitle("テスト 第1巻").volume).toBe("1");
  });

  it("〇〇 ①", () => {
    expect(normalizeTitle("テスト ①").volume).toBe("1");
  });

  it("〇〇 Vol.1", () => {
    expect(normalizeTitle("テスト Vol.1").volume).toBe("1");
  });

  it("〇〇（上）→ 1 に統一", () => {
    expect(normalizeTitle("テスト（上）").volume).toBe("1");
  });

  it("〇〇 上巻 → 1 に統一", () => {
    expect(normalizeTitle("テスト 上巻").volume).toBe("1");
  });

  it("〇〇 Part 1", () => {
    expect(normalizeTitle("テスト Part 1").volume).toBe("1");
  });

  it("〇〇（中）→ 2 に統一", () => {
    expect(normalizeTitle("テスト（中）").volume).toBe("2");
  });

  it("〇〇（下）→ 3 に統一", () => {
    expect(normalizeTitle("テスト（下）").volume).toBe("3");
  });
});
