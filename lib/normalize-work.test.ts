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

// ============================================================
// PR-B2: ローマ数字巻数抽出
// ============================================================
describe("normalizeTitle - ローマ数字巻数", () => {
  // --- II〜X: 末尾にあれば抽出（スペースなしも可） ---
  it("末尾ローマ数字II（スペースなし）: 基礎II → volume: 2", () => {
    const result = normalizeTitle("フォルマシオン・ミュジカル基礎II");
    expect(result.volume).toBe("2");
    expect(result.normalized).not.toContain("II");
  });

  it("末尾ローマ数字III（スペースなし）: 日韓国交正常化III → volume: 3", () => {
    const result = normalizeTitle("日韓国交正常化III");
    expect(result.volume).toBe("3");
  });

  it("末尾ローマ数字IV: テストIV → volume: 4", () => {
    expect(normalizeTitle("テストIV").volume).toBe("4");
  });

  it("末尾ローマ数字V: テストV → volume: 5", () => {
    expect(normalizeTitle("テストV").volume).toBe("5");
  });

  it("末尾ローマ数字VIII: テストVIII → volume: 8", () => {
    expect(normalizeTitle("テストVIII").volume).toBe("8");
  });

  it("末尾ローマ数字X: テストX ��� volume: 10", () => {
    expect(normalizeTitle("テストX").volume).toBe("10");
  });

  it("スペース付きローマ数��: テスト II → volume: 2", () => {
    expect(normalizeTitle("テスト II").volume).toBe("2");
  });

  it("小文字ローマ数字: テストiii → volume: 3", () => {
    expect(normalizeTitle("テストiii").volume).toBe("3");
  });

  // --- 同タイトル・別巻数の分離確認 ---
  it("基礎I vs 基礎II が別 volume として抽出", () => {
    const a = normalizeTitle("フォルマシオン・ミュジカル基礎（I）");
    const b = normalizeTitle("フォルマシオン・ミュジカル基礎II");
    expect(a.volume).toBe("1");
    expect(b.volume).toBe("2");
    // 正規化タイトルは同じ（巻数を除いた部分）
    expect(a.normalized).toBe(b.normalized);
  });

  it("現代日本会計学説批判II vs III が別 volume", () => {
    const a = normalizeTitle("現代日本会計学説批判II");
    const b = normalizeTitle("現代日本会計学説批判III");
    expect(a.volume).toBe("2");
    expect(b.volume).toBe("3");
    expect(a.normalized).toBe(b.normalized);
  });

  // --- 全角ローマ数字 (NFKC で半角化される) ---
  it("全角Ⅱ: テストⅡ → volume: 2", () => {
    expect(normalizeTitle("テストⅡ").volume).toBe("2");
  });

  it("全角Ⅲ: テストⅢ → volume: 3", () => {
    expect(normalizeTitle("テストⅢ").volume).toBe("3");
  });

  it("全角Ⅳ: テストⅣ → volume: 4", () => {
    expect(normalizeTitle("テストⅣ").volume).toBe("4");
  });

  it("全角Ⅹ: テストⅩ → volume: 10", () => {
    expect(normalizeTitle("テストⅩ").volume).toBe("10");
  });

  // --- 括弧付き I は安全に認識 ---
  it("括弧付き(I): テスト(I) → volume: 1", () => {
    expect(normalizeTitle("テスト(I)").volume).toBe("1");
  });

  it("括弧付き（Ⅰ）: テスト（Ⅰ） → volume: 1", () => {
    expect(normalizeTitle("テスト（Ⅰ）").volume).toBe("1");
  });

  // --- Vol.I, 第I巻 は明示パターンとして安全 ---
  it("Vol.I: テスト Vol.I → volume: 1", () => {
    expect(normalizeTitle("テスト Vol.I").volume).toBe("1");
  });

  it("Vol.III: テスト Vol.III → volume: 3", () => {
    expect(normalizeTitle("テスト Vol.III").volume).toBe("3");
  });

  it("第I巻: テスト 第I巻 → volume: 1", () => {
    expect(normalizeTitle("テスト 第I巻").volume).toBe("1");
  });

  // --- 誤認識防止: 単独 I は末尾でも認識しない ---
  it("AI入門: 末尾の I が巻数にならない", () => {
    const result = normalizeTitle("AI入門");
    expect(result.volume).toBeNull();
  });

  it("英単語末尾の I: ALIBI → 巻数にならない", () => {
    const result = normalizeTitle("ALIBI");
    expect(result.volume).toBeNull();
  });

  // --- 英単語末尾のローマ数字 II が単語の一部の場合 ---
  // "ASCII" の末尾 II は直前が英字なのでマッチしない
  it("ASCII: 末尾 II だが英字の一部 → 巻数にならない", () => {
    const result = normalizeTitle("ASCII");
    expect(result.volume).toBeNull();
  });

  // --- PR-B7: 角括弧パターン ---
  it("角括弧[II]: 日本の家計行動のダイナミズム[II] → volume: 2", () => {
    expect(normalizeTitle("日本の家計行動のダイナミズム[II]").volume).toBe("2");
  });

  it("角括弧[III]: 日本の家計行動のダイナミズム[III] → volume: 3", () => {
    expect(normalizeTitle("日本の家計行動のダイナミズム[III]").volume).toBe("3");
  });

  it("角括弧[2]: テスト[2] → volume: 2", () => {
    expect(normalizeTitle("テスト[2]").volume).toBe("2");
  });

  it("隅付き括弧【5】: テスト【5】 → volume: 5", () => {
    expect(normalizeTitle("テスト【5】").volume).toBe("5");
  });

  it("角括弧[I]: テスト[I] → volume: null (単独I除外)", () => {
    expect(normalizeTitle("テスト[I]").volume).toBeNull();
  });

  it("角括弧[改訂版]: テスト[改訂版] → volume: null (数字/ローマ数字でない)", () => {
    expect(normalizeTitle("テスト[改訂版]").volume).toBeNull();
  });

  // --- PR-B7: 修飾語前ローマ数字パターン ---
  it("修飾語前: 正常化II〈新装版〉 → volume: 2", () => {
    expect(normalizeTitle("歴史としての日韓国交正常化II〈新装版〉").volume).toBe("2");
  });

  it("修飾語前: タイトルIII（増補版） → volume: 3", () => {
    expect(normalizeTitle("タイトルIII（増補版）").volume).toBe("3");
  });

  it("修飾語なし末尾II: タイトルII → volume: 2 (既存パターンで抽出)", () => {
    // 末尾密着ローマ数字（日本語の後）は既存パターンで動作
    expect(normalizeTitle("タイトルII").volume).toBe("2");
  });

  it("年度数字: 過去問 2015 → volume: null (4桁は除外)", () => {
    expect(normalizeTitle("過去問 2015").volume).toBeNull();
  });
});
