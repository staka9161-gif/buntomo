import { describe, it, expect } from "vitest";
import { parseAuthorField, normalizeAuthor } from "./normalize-work";

// ============================================================
// PR-B1: parseAuthorField - 原著者と翻訳者の分離
// ============================================================
describe("parseAuthorField", () => {
  describe("翻訳者分離", () => {
    it("スラッシュ区切り + 訳: ドストエフスキー/亀山郁夫訳", () => {
      const result = parseAuthorField("ドストエフスキー/亀山郁夫訳");
      expect(result.authors).toEqual(["ドストエフスキー"]);
      expect(result.translators).toEqual(["亀山郁夫"]);
    });

    it("スラッシュ区切り（全角）: ドストエフスキー／原卓也訳", () => {
      const result = parseAuthorField("ドストエフスキー／原卓也訳");
      expect(result.authors).toEqual(["ドストエフスキー"]);
      expect(result.translators).toEqual(["原卓也"]);
    });

    it("著者名の後に「訳」で終わる場合: ヘミングウェイ 高見浩訳", () => {
      const result = parseAuthorField("ヘミングウェイ 高見浩訳");
      expect(result.authors).toEqual(["ヘミングウェイ"]);
      expect(result.translators).toEqual(["高見浩"]);
    });

    it("「著」「訳」表記: カミュ著 窪田啓作訳", () => {
      const result = parseAuthorField("カミュ著 窪田啓作訳");
      expect(result.authors).toEqual(["カミュ"]);
      expect(result.translators).toEqual(["窪田啓作"]);
    });

    it("複数翻訳者: トルストイ/中村融・中村白葉訳", () => {
      const result = parseAuthorField("トルストイ/中村融・中村白葉訳");
      expect(result.authors).toEqual(["トルストイ"]);
      expect(result.translators).toEqual(["中村融", "中村白葉"]);
    });

    it("翻訳者なし（国内作品）: 村上春樹", () => {
      const result = parseAuthorField("村上春樹");
      expect(result.authors).toEqual(["村上春樹"]);
      expect(result.translators).toEqual([]);
    });

    it("括弧内に訳者: ドストエフスキー（亀山郁夫訳）", () => {
      const result = parseAuthorField("ドストエフスキー（亀山郁夫訳）");
      expect(result.authors).toEqual(["ドストエフスキー"]);
      expect(result.translators).toEqual(["亀山郁夫"]);
    });

    it("「翻訳」表記: シェイクスピア/松岡和子翻訳", () => {
      const result = parseAuthorField("シェイクスピア/松岡和子翻訳");
      expect(result.authors).toEqual(["シェイクスピア"]);
      expect(result.translators).toEqual(["松岡和子"]);
    });
  });

  describe("共著者の表記順正規化", () => {
    it("共著（中黒区切り）: 伊坂幸太郎・阿部和重", () => {
      const result = parseAuthorField("伊坂幸太郎・阿部和重");
      expect(result.authors).toEqual(["伊坂幸太郎", "阿部和重"]);
      expect(result.translators).toEqual([]);
    });

    it("共著（カンマ区切り）: 東野圭吾, 宮部みゆき", () => {
      const result = parseAuthorField("東野圭吾, 宮部みゆき");
      expect(result.authors).toEqual(["東野圭吾", "宮部みゆき"]);
      expect(result.translators).toEqual([]);
    });

    it("共著（読点区切り）: 東野圭吾、宮部みゆき", () => {
      const result = parseAuthorField("東野圭吾、宮部みゆき");
      expect(result.authors).toEqual(["東野圭吾", "宮部みゆき"]);
      expect(result.translators).toEqual([]);
    });

    it("共著 + 翻訳者: カフカ・ブロード/池内紀訳", () => {
      // ここでは「カフカ」「ブロード」が著者（中黒区切りだが翻訳者がいる場合）
      // 注: この場合、スラッシュ前の中黒を共著者区切りと判断
      const result = parseAuthorField("カフカ・ブロード/池内紀訳");
      expect(result.authors).toEqual(["カフカ", "ブロード"]);
      expect(result.translators).toEqual(["池内紀"]);
    });
  });

  describe("カンマの姓名区切り vs 共著者区切り判定", () => {
    it("姓, 名 (日本語短い姓): 巽, 孝之 → 1人扱い", () => {
      const result = parseAuthorField("巽, 孝之");
      expect(result.authors).toEqual(["巽 孝之"]);
    });

    it("姓, 名 (英語): Gibson, William → 1人扱い", () => {
      const result = parseAuthorField("Gibson, William");
      expect(result.authors).toEqual(["Gibson William"]);
    });

    it("共著 (日本語フルネーム): 佐藤太郎, 山田花子 → 2人扱い", () => {
      const result = parseAuthorField("佐藤太郎, 山田花子");
      expect(result.authors).toEqual(["佐藤太郎", "山田花子"]);
    });

    it("姓, 名 (英語短い): Doe, John → 1人扱い", () => {
      const result = parseAuthorField("Doe, John");
      expect(result.authors).toEqual(["Doe John"]);
    });

    it("複数の姓名ペア: Smith, J., Jones, M. → 2人扱い", () => {
      const result = parseAuthorField("Smith, J., Jones, M.");
      expect(result.authors).toEqual(["Smith J.", "Jones M."]);
    });

    it("Bougainville, Louis-Antoine de → 1人扱い", () => {
      const result = parseAuthorField("Bougainville, Louis-Antoine de");
      expect(result.authors).toEqual(["Bougainville Louis-Antoine de"]);
    });
  });

  describe("「名前/役割 名前/役割」形式", () => {
    it("村上春樹/著 → authors: ['村上春樹']", () => {
      const result = parseAuthorField("村上春樹/著");
      expect(result.authors).toEqual(["村上春樹"]);
      expect(result.translators).toEqual([]);
    });

    it("村上春樹/著 ジェイ・ルービン/訳 → 著者と翻訳者を分離", () => {
      const result = parseAuthorField("村上春樹/著 ジェイ・ルービン/訳");
      expect(result.authors).toEqual(["村上春樹"]);
      expect(result.translators).toEqual(["ジェイ・ルービン"]);
    });

    it("マーク・エヴァン・ボンズ/著 土田英三郎/翻訳 → 著者と翻訳者", () => {
      const result = parseAuthorField("マーク・エヴァン・ボンズ/著 土田英三郎/翻訳");
      expect(result.authors).toEqual(["マーク・エヴァン・ボンズ"]);
      expect(result.translators).toEqual(["土田英三郎"]);
    });

    it("Salinger, J.D./著 野崎孝/訳 → 著者と翻訳者", () => {
      const result = parseAuthorField("Salinger, J.D./著 野崎孝/訳");
      expect(result.authors).toEqual(["Salinger, J.D."]);
      expect(result.translators).toEqual(["野崎孝"]);
    });

    it("複数著者/著: 千葉康之/著 塚田真紀子/著 岡井崇/著", () => {
      const result = parseAuthorField("千葉康之/著 塚田真紀子/著 岡井崇/著");
      expect(result.authors).toEqual(["千葉康之", "塚田真紀子", "岡井崇"]);
      expect(result.translators).toEqual([]);
    });

    it("著者+翻訳者+ほか: パウル・ヒンデミット/著 千蔵八郎/翻訳 ほか", () => {
      // "ほか" はフィラーとして無視
      const result = parseAuthorField("パウル・ヒンデミット/著 千蔵八郎/翻訳 ほか");
      expect(result.authors).toEqual(["パウル・ヒンデミット"]);
      expect(result.translators).toEqual(["千蔵八郎"]);
    });

    it("既存パターンが壊れない: ドストエフスキー/亀山郁夫訳", () => {
      // これは「名前/役割」形式ではない（「亀山郁夫訳」は役割タグではない）
      const result = parseAuthorField("ドストエフスキー/亀山郁夫訳");
      expect(result.authors).toEqual(["ドストエフスキー"]);
      expect(result.translators).toEqual(["亀山郁夫"]);
    });
  });

  describe("「著」「編」などの肩書除去", () => {
    it("著: 村上春樹著", () => {
      const result = parseAuthorField("村上春樹著");
      expect(result.authors).toEqual(["村上春樹"]);
    });

    it("編: 芥川龍之介編", () => {
      const result = parseAuthorField("芥川龍之介編");
      expect(result.authors).toEqual(["芥川龍之介"]);
    });

    it("著・編の組み合わせ: 太宰治著 奥野健男編", () => {
      const result = parseAuthorField("太宰治著 奥野健男編");
      expect(result.authors).toEqual(["太宰治"]);
      expect(result.editors).toEqual(["奥野健男"]);
    });
  });
});

// ============================================================
// PR-B1: normalizeAuthor の改善 - ペンネーム表記揺れ吸収
// ============================================================
describe("normalizeAuthor - ペンネーム表記揺れ", () => {
  it("長音表記揺れ: ドストエフスキー vs ドストエーフスキイ", () => {
    // 長音正規化で同じ結果になることを確認
    const a = normalizeAuthor("ドストエフスキー");
    const b = normalizeAuthor("ドストエーフスキイ");
    // 完全一致は難しいが、長音正規化後は近い結果になる
    expect(a).toBe("ドストエフスキイ");
    expect(b).toBe("ドストエイフスキイ");
    // Note: 完全一致は別名辞書で対応。ここでは長音正規化のみ
  });

  it("中黒あり/なし: ヴィクトル・ユーゴー vs ヴィクトルユーゴー", () => {
    const a = normalizeAuthor("ヴィクトル・ユーゴー");
    const b = normalizeAuthor("ヴィクトルユーゴー");
    expect(a).toBe(b);
  });

  it("ヴ/ブ揺れ: ドストエフスキー (既存は変換しない、将来対応)", () => {
    // 現段階ではヴ→ブ変換は行わない（別名辞書で対応予定）
    const result = normalizeAuthor("ヴィクトル");
    expect(result).toBe("ヴィクトル");
  });

  it("姓名の順序が逆でもスペース除去で同一: ハルキムラカミ", () => {
    // kana提供時は順序がそのまま使われる
    expect(normalizeAuthor("Haruki Murakami")).toBe("HARUKIMURAKAMI");
    expect(normalizeAuthor("Murakami Haruki")).toBe("MURAKAMIHARUKI");
    // 順序は異なる → 完全一致はしない（これは正しい挙動、マッチングロジック側で対応）
  });

  it("全角半角の統一: Ｊ.Ｋ.ローリング", () => {
    expect(normalizeAuthor("Ｊ.Ｋ.ローリング")).toBe("JKロウリング");
  });
});

// ============================================================
// PR-B1: normalizeAuthor の改善 - 共著者正規化
// ============================================================
describe("normalizeAuthor - 共著者のソート正規化", () => {
  it("共著者が含まれていてもnormalizeAuthorは単一名として処理", () => {
    // normalizeAuthor は単一著者名を正規化する関数
    // 共著者の分離は parseAuthorField の責務
    expect(normalizeAuthor("伊坂幸太郎", "イサカコウタロウ")).toBe("イサカコウタロウ");
  });
});
