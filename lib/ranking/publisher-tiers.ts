// ============================================================
// 出版社・レーベル ティアマスタデータ
// S層(+50): メジャー文庫・新書レーベル
// A層(+30): 大手総合出版社の単行本
// B層(+15): 中堅・専門出版社
// C層(0):   上記以外
// D層(-20): 同人・自費出版系
// ============================================================

export type TierLevel = "S" | "A" | "B" | "C" | "D";

export const TIER_SCORES: Record<TierLevel, number> = {
  S: 50,
  A: 30,
  B: 15,
  C: 0,
  D: -20,
};

export interface PublisherEntry {
  name: string;
  tier: TierLevel;
  aliases?: string[];
  labels?: { name: string; tier: TierLevel; aliases?: string[] }[];
}

// ============================================================
// S層レーベル（文庫・新書）は labels 内に定義
// 親出版社はA層に配置し、傘下レーベルをS層で定義
// ============================================================
export const PUBLISHER_MASTER: PublisherEntry[] = [
  // ── 大手総合出版社 ──
  {
    name: "新潮社",
    tier: "A",
    aliases: ["しんちょうしゃ", "Shinchosha"],
    labels: [
      { name: "新潮文庫", tier: "S" },
      { name: "新潮新書", tier: "S" },
      { name: "新潮選書", tier: "S" },
      { name: "新潮クレスト・ブックス", tier: "S" },
    ],
  },
  {
    name: "講談社",
    tier: "A",
    aliases: ["こうだんしゃ", "Kodansha"],
    labels: [
      { name: "講談社文庫", tier: "S" },
      { name: "講談社現代新書", tier: "S" },
      { name: "講談社学術文庫", tier: "S" },
      { name: "講談社文芸文庫", tier: "S" },
      { name: "講談社+α文庫", tier: "S" },
      { name: "講談社+α新書", tier: "S" },
      { name: "ブルーバックス", tier: "S" },
      { name: "講談社ラノベ文庫", tier: "B" },
      { name: "星海社新書", tier: "B" },
    ],
  },
  {
    name: "文藝春秋",
    tier: "A",
    aliases: ["ぶんげいしゅんじゅう", "文芸春秋"],
    labels: [
      { name: "文春文庫", tier: "S" },
      { name: "文春新書", tier: "S" },
    ],
  },
  {
    name: "KADOKAWA",
    tier: "A",
    aliases: ["カドカワ", "角川書店", "角川グループ", "Kadokawa"],
    labels: [
      { name: "角川文庫", tier: "S" },
      { name: "角川新書", tier: "S" },
      { name: "角川ソフィア文庫", tier: "S" },
      { name: "角川選書", tier: "S" },
      { name: "富士見ファンタジア文庫", tier: "B" },
      { name: "電撃文庫", tier: "B" },
      { name: "角川ホラー文庫", tier: "S" },
      { name: "角川つばさ文庫", tier: "B" },
      { name: "メディアワークス文庫", tier: "B" },
    ],
  },
  {
    name: "集英社",
    tier: "A",
    aliases: ["しゅうえいしゃ", "Shueisha"],
    labels: [
      { name: "集英社文庫", tier: "S" },
      { name: "集英社新書", tier: "S" },
      { name: "集英社文芸単行本", tier: "A" },
    ],
  },
  {
    name: "小学館",
    tier: "A",
    aliases: ["しょうがくかん", "Shogakukan"],
    labels: [
      { name: "小学館文庫", tier: "S" },
      { name: "小学館新書", tier: "S" },
    ],
  },
  {
    name: "岩波書店",
    tier: "A",
    aliases: ["いわなみしょてん", "Iwanami"],
    labels: [
      { name: "岩波文庫", tier: "S" },
      { name: "岩波新書", tier: "S" },
      { name: "岩波現代文庫", tier: "S" },
      { name: "岩波少年文庫", tier: "S" },
      { name: "岩波ジュニア新書", tier: "S" },
    ],
  },
  {
    name: "河出書房新社",
    tier: "A",
    aliases: ["かわでしょぼうしんしゃ", "Kawade"],
    labels: [
      { name: "河出文庫", tier: "S" },
    ],
  },
  {
    name: "筑摩書房",
    tier: "A",
    aliases: ["ちくましょぼう", "Chikuma"],
    labels: [
      { name: "ちくま文庫", tier: "S" },
      { name: "ちくま新書", tier: "S" },
      { name: "ちくま学芸文庫", tier: "S" },
      { name: "ちくまプリマー新書", tier: "S" },
    ],
  },
  {
    name: "光文社",
    tier: "A",
    aliases: ["こうぶんしゃ", "Kobunsha"],
    labels: [
      { name: "光文社文庫", tier: "S" },
      { name: "光文社古典新訳文庫", tier: "S" },
      { name: "光文社新書", tier: "S" },
    ],
  },
  {
    name: "中央公論新社",
    tier: "A",
    aliases: ["ちゅうおうこうろんしんしゃ", "中央公論", "中公"],
    labels: [
      { name: "中公文庫", tier: "S" },
      { name: "中公新書", tier: "S" },
      { name: "中公新書ラクレ", tier: "S" },
    ],
  },
  {
    name: "早川書房",
    tier: "A",
    aliases: ["はやかわしょぼう", "Hayakawa"],
    labels: [
      { name: "ハヤカワ文庫SF", tier: "S", aliases: ["ハヤカワ文庫 SF"] },
      { name: "ハヤカワ文庫JA", tier: "S", aliases: ["ハヤカワ文庫 JA"] },
      { name: "ハヤカワ文庫NV", tier: "S", aliases: ["ハヤカワ文庫 NV"] },
      { name: "ハヤカワ文庫NF", tier: "S", aliases: ["ハヤカワ・ノンフィクション文庫"] },
      { name: "ハヤカワ・ミステリ文庫", tier: "S" },
      { name: "ハヤカワepi文庫", tier: "S" },
    ],
  },
  {
    name: "白水社",
    tier: "A",
    aliases: ["はくすいしゃ", "Hakusuisha"],
    labels: [
      { name: "白水Uブックス", tier: "S" },
    ],
  },
  {
    name: "みすず書房",
    tier: "A",
    aliases: ["Misuzu"],
  },
  {
    name: "東京創元社",
    tier: "A",
    aliases: ["とうきょうそうげんしゃ", "Sogensha"],
    labels: [
      { name: "創元推理文庫", tier: "S" },
      { name: "創元SF文庫", tier: "S" },
    ],
  },
  {
    name: "幻冬舎",
    tier: "A",
    aliases: ["げんとうしゃ", "Gentosha"],
    labels: [
      { name: "幻冬舎文庫", tier: "S" },
      { name: "幻冬舎新書", tier: "S" },
    ],
  },
  {
    name: "青土社",
    tier: "A",
    aliases: ["せいどしゃ"],
  },
  {
    name: "作品社",
    tier: "A",
    aliases: ["さくひんしゃ"],
  },
  {
    name: "ダイヤモンド社",
    tier: "A",
    aliases: ["Diamond"],
  },
  {
    name: "東洋経済新報社",
    tier: "A",
    aliases: ["とうようけいざい", "東洋経済"],
  },
  {
    name: "日経BP",
    tier: "A",
    aliases: ["にっけいBP", "日経ビジネス"],
  },
  {
    name: "朝日新聞出版",
    tier: "A",
    aliases: ["あさひしんぶん", "朝日新聞社"],
    labels: [
      { name: "朝日文庫", tier: "S" },
      { name: "朝日新書", tier: "S" },
    ],
  },
  {
    name: "毎日新聞出版",
    tier: "A",
    aliases: ["毎日新聞社"],
  },
  {
    name: "NHK出版",
    tier: "A",
    aliases: ["NHK", "日本放送出版協会"],
    labels: [
      { name: "NHKブックス", tier: "S" },
    ],
  },
  {
    name: "平凡社",
    tier: "A",
    aliases: ["へいぼんしゃ", "Heibonsha"],
    labels: [
      { name: "平凡社ライブラリー", tier: "S" },
      { name: "平凡社新書", tier: "S" },
    ],
  },
  {
    name: "人文書院",
    tier: "A",
    aliases: ["じんぶんしょいん"],
  },
  {
    name: "静山社",
    tier: "A",
    aliases: ["せいざんしゃ"],
  },
  {
    name: "徳間書店",
    tier: "A",
    aliases: ["とくましょてん", "Tokuma"],
    labels: [
      { name: "徳間文庫", tier: "S" },
    ],
  },
  {
    name: "双葉社",
    tier: "A",
    aliases: ["ふたばしゃ", "Futabasha"],
    labels: [
      { name: "双葉文庫", tier: "S" },
    ],
  },
  {
    name: "実業之日本社",
    tier: "A",
    aliases: ["じつぎょうのにほんしゃ"],
    labels: [
      { name: "実業之日本社文庫", tier: "S" },
    ],
  },
  {
    name: "祥伝社",
    tier: "A",
    aliases: ["しょうでんしゃ"],
    labels: [
      { name: "祥伝社文庫", tier: "S" },
      { name: "祥伝社新書", tier: "S" },
    ],
  },
  {
    name: "PHP研究所",
    tier: "A",
    aliases: ["PHP"],
    labels: [
      { name: "PHP新書", tier: "S" },
      { name: "PHP文庫", tier: "S" },
    ],
  },
  {
    name: "扶桑社",
    tier: "A",
    aliases: ["ふそうしゃ"],
    labels: [
      { name: "扶桑社文庫", tier: "S" },
    ],
  },
  {
    name: "宝島社",
    tier: "A",
    aliases: ["たからじましゃ"],
    labels: [
      { name: "宝島社文庫", tier: "S" },
    ],
  },
  {
    name: "ポプラ社",
    tier: "A",
    aliases: ["Poplar"],
    labels: [
      { name: "ポプラ文庫", tier: "S" },
    ],
  },

  // ── 中堅・専門出版社 (B層) ──
  {
    name: "オライリー・ジャパン",
    tier: "B",
    aliases: ["O'Reilly Japan", "O'Reilly", "オライリージャパン", "オライリー"],
  },
  {
    name: "技術評論社",
    tier: "B",
    aliases: ["ぎじゅつひょうろんしゃ", "Gihyo"],
  },
  {
    name: "翔泳社",
    tier: "B",
    aliases: ["しょうえいしゃ", "Shoeisha"],
  },
  {
    name: "SBクリエイティブ",
    tier: "B",
    aliases: ["SB Creative", "ソフトバンククリエイティブ", "ソフトバンク"],
    labels: [
      { name: "SB新書", tier: "B" },
      { name: "GA文庫", tier: "B" },
    ],
  },
  {
    name: "インプレス",
    tier: "B",
    aliases: ["Impress"],
  },
  {
    name: "オーム社",
    tier: "B",
    aliases: ["Ohmsha"],
  },
  {
    name: "森北出版",
    tier: "B",
  },
  {
    name: "医学書院",
    tier: "B",
    aliases: ["いがくしょいん"],
  },
  {
    name: "南江堂",
    tier: "B",
    aliases: ["なんこうどう"],
  },
  {
    name: "有斐閣",
    tier: "B",
    aliases: ["ゆうひかく", "Yuhikaku"],
  },
  {
    name: "勁草書房",
    tier: "B",
    aliases: ["けいそうしょぼう"],
  },
  {
    name: "ミネルヴァ書房",
    tier: "B",
    aliases: ["Minerva"],
  },
  {
    name: "明治書院",
    tier: "B",
  },
  {
    name: "青弓社",
    tier: "B",
  },
  {
    name: "柏書房",
    tier: "B",
  },
  {
    name: "晶文社",
    tier: "B",
    aliases: ["しょうぶんしゃ"],
  },
  {
    name: "原書房",
    tier: "B",
  },
  {
    name: "早稲田大学出版部",
    tier: "B",
  },
  {
    name: "東京大学出版会",
    tier: "B",
    aliases: ["東大出版会"],
  },
  {
    name: "京都大学学術出版会",
    tier: "B",
    aliases: ["京大出版会"],
  },
  {
    name: "名古屋大学出版会",
    tier: "B",
  },
  {
    name: "慶應義塾大学出版会",
    tier: "B",
  },
  {
    name: "ハーパーコリンズ・ジャパン",
    tier: "B",
    aliases: ["HarperCollins Japan"],
  },
  {
    name: "小学館集英社プロダクション",
    tier: "B",
    aliases: ["ShoPro"],
  },
  {
    name: "岩崎書店",
    tier: "B",
  },
  {
    name: "あかね書房",
    tier: "B",
  },
  {
    name: "金の星社",
    tier: "B",
  },
  {
    name: "偕成社",
    tier: "B",
    aliases: ["かいせいしゃ"],
  },
  {
    name: "童心社",
    tier: "B",
  },
  {
    name: "福音館書店",
    tier: "B",
    aliases: ["ふくいんかんしょてん"],
  },
  {
    name: "理論社",
    tier: "B",
  },
  {
    name: "草思社",
    tier: "B",
    aliases: ["そうししゃ"],
  },
  {
    name: "日本経済新聞出版",
    tier: "B",
    aliases: ["日本経済新聞出版社", "日経出版"],
  },
  {
    name: "かんき出版",
    tier: "B",
  },
  {
    name: "すばる舎",
    tier: "B",
  },
  {
    name: "サンマーク出版",
    tier: "B",
  },
  {
    name: "フォレスト出版",
    tier: "B",
  },
  {
    name: "日本実業出版社",
    tier: "B",
  },
  {
    name: "秀和システム",
    tier: "B",
  },
  {
    name: "ナツメ社",
    tier: "B",
  },
  {
    name: "誠文堂新光社",
    tier: "B",
  },
  {
    name: "世界文化社",
    tier: "B",
  },
  {
    name: "主婦の友社",
    tier: "B",
  },
  {
    name: "主婦と生活社",
    tier: "B",
  },
  {
    name: "マガジンハウス",
    tier: "B",
  },
  {
    name: "文響社",
    tier: "B",
  },
  {
    name: "飛鳥新社",
    tier: "B",
  },
  {
    name: "ディスカヴァー・トゥエンティワン",
    tier: "B",
    aliases: ["Discover 21", "ディスカヴァー"],
  },
  {
    name: "CCCメディアハウス",
    tier: "B",
    aliases: ["阪急コミュニケーションズ"],
  },
  {
    name: "春秋社",
    tier: "B",
  },
  {
    name: "法藏館",
    tier: "B",
    aliases: ["法蔵館"],
  },
  {
    name: "吉川弘文館",
    tier: "B",
  },
  {
    name: "山川出版社",
    tier: "B",
  },
  {
    name: "中経出版",
    tier: "B",
  },
  {
    name: "日本評論社",
    tier: "B",
  },
  {
    name: "弘文堂",
    tier: "B",
  },
  {
    name: "成文堂",
    tier: "B",
  },
  {
    name: "信山社",
    tier: "B",
  },
  {
    name: "商事法務",
    tier: "B",
  },
  {
    name: "朝倉書店",
    tier: "B",
  },
  {
    name: "丸善出版",
    tier: "B",
    aliases: ["丸善"],
  },
  {
    name: "共立出版",
    tier: "B",
  },
  {
    name: "裳華房",
    tier: "B",
  },
  {
    name: "培風館",
    tier: "B",
  },
  {
    name: "コロナ社",
    tier: "B",
  },
  {
    name: "CQ出版",
    tier: "B",
  },
  {
    name: "羊土社",
    tier: "B",
  },
  {
    name: "メジカルビュー社",
    tier: "B",
  },
  {
    name: "南山堂",
    tier: "B",
  },
  {
    name: "金原出版",
    tier: "B",
  },
  {
    name: "永岡書店",
    tier: "B",
  },
  {
    name: "彩図社",
    tier: "B",
  },
  {
    name: "TAC出版",
    tier: "B",
  },
  {
    name: "大和書房",
    tier: "B",
  },
  {
    name: "クロスメディア・パブリッシング",
    tier: "B",
  },
  {
    name: "プレジデント社",
    tier: "B",
  },
  {
    name: "東京書籍",
    tier: "B",
  },
  {
    name: "三省堂",
    tier: "B",
  },
  {
    name: "大修館書店",
    tier: "B",
  },
  {
    name: "研究社",
    tier: "B",
  },
  {
    name: "白泉社",
    tier: "B",
    labels: [
      { name: "白泉社文庫", tier: "S" },
    ],
  },
  {
    name: "竹書房",
    tier: "B",
    labels: [
      { name: "竹書房文庫", tier: "S" },
    ],
  },
  {
    name: "学研プラス",
    tier: "B",
    aliases: ["学研", "Gakken"],
  },
  {
    name: "角川春樹事務所",
    tier: "B",
    labels: [
      { name: "ハルキ文庫", tier: "S" },
    ],
  },
];

// ============================================================
// ルックアップ用の正規化マップを構築
// ============================================================

/** 正規化された出版社名 → ティア */
const publisherTierMap = new Map<string, TierLevel>();

/** 正規化されたレーベル名 → ティア */
const labelTierMap = new Map<string, TierLevel>();

function normalizeForLookup(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .replace(/[株式会社(株)㈱（）()]/g, "")
    .toLowerCase();
}

// マスタデータからマップを構築
for (const pub of PUBLISHER_MASTER) {
  const normName = normalizeForLookup(pub.name);
  publisherTierMap.set(normName, pub.tier);

  // エイリアスも登録
  if (pub.aliases) {
    for (const alias of pub.aliases) {
      publisherTierMap.set(normalizeForLookup(alias), pub.tier);
    }
  }

  // レーベルを登録
  if (pub.labels) {
    for (const label of pub.labels) {
      const normLabel = normalizeForLookup(label.name);
      labelTierMap.set(normLabel, label.tier);
      if (label.aliases) {
        for (const alias of label.aliases) {
          labelTierMap.set(normalizeForLookup(alias), label.tier);
        }
      }
    }
  }
}

/**
 * 出版社名からティアを取得
 */
export function lookupPublisherTier(publisher: string): TierLevel {
  const norm = normalizeForLookup(publisher);

  // 完全一致
  const exact = publisherTierMap.get(norm);
  if (exact) return exact;

  // レーベル名としても検索
  const labelExact = labelTierMap.get(norm);
  if (labelExact) return labelExact;

  // 部分一致: マスタの出版社名が入力に含まれるか
  for (const [key, tier] of publisherTierMap) {
    if (norm.includes(key) || key.includes(norm)) {
      return tier;
    }
  }

  return "C";
}

/**
 * レーベル名からティアを取得
 */
export function lookupLabelTier(label: string): TierLevel {
  const norm = normalizeForLookup(label);

  const exact = labelTierMap.get(norm);
  if (exact) return exact;

  // 部分一致
  for (const [key, tier] of labelTierMap) {
    if (norm.includes(key) || key.includes(norm)) {
      return tier;
    }
  }

  return "C";
}

/**
 * 出版社名とレーベル名の両方を考慮して最良のティアとスコアを返す
 */
export function getPublisherTierAndScore(
  publisher: string | null | undefined,
  label: string | null | undefined
): { tier: TierLevel; score: number } {
  let bestTier: TierLevel = "C";

  if (label) {
    const labelTier = lookupLabelTier(label);
    bestTier = labelTier;
  }

  if (publisher) {
    const pubTier = lookupPublisherTier(publisher);
    // レーベルのティアの方が高ければそちらを採用
    if (TIER_SCORES[pubTier] > TIER_SCORES[bestTier]) {
      bestTier = pubTier;
    }
  }

  return { tier: bestTier, score: TIER_SCORES[bestTier] };
}
