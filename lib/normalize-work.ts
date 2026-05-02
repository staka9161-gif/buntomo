// ============================================================
// Work/Edition マッチング用の正規化ユーティリティ
//
// 既存の normalize.ts（検索用）とは別に、Work 同定のための
// より積極的な正規化を行う。
// ============================================================

export interface NormalizedTitle {
  /** 正規化済みタイトル（マッチング用） */
  normalized: string;
  /** 抽出された巻数（"1", "上" など）。なければ null */
  volume: string | null;
  /** 分離された副題。なければ null */
  subtitle: string | null;
}

// ============================================================
// ひらがな → カタカナ
// ============================================================
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

// ============================================================
// 丸数字 → 算用数字
// ============================================================
const CIRCLED_DIGITS: Record<string, string> = {
  "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5",
  "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9", "⑩": "10",
  "⑪": "11", "⑫": "12", "⑬": "13", "⑭": "14", "⑮": "15",
  "⑯": "16", "⑰": "17", "⑱": "18", "⑲": "19", "⑳": "20",
};

function replaceCircledDigits(str: string): string {
  return str.replace(/[①-⑳]/g, (ch) => CIRCLED_DIGITS[ch] || ch);
}

// ============================================================
// 上/中/下 → 数字への統一マップ（巻数比較用）
// ============================================================
const VOLUME_MAP: Record<string, string> = {
  "上": "1", "中": "2", "下": "3",
};

// 逆引き: 数字 → 上中下 にはしない（上中下 → 数字に統一）
function normalizeVolume(vol: string): string {
  return VOLUME_MAP[vol] || vol;
}

// ============================================================
// 巻数パターン（タイトル末尾から抽出）
// 優先度順に並べる。最初にマッチしたものを採用。
// ============================================================
const VOLUME_PATTERNS: { pattern: RegExp; extract: (m: RegExpMatchArray) => string }[] = [
  // BOOK1, BOOK 1, Book1
  { pattern: /\s*BOOK\s*(\d+)\s*$/i, extract: (m) => m[1] },
  // Vol.1, Vol 1
  { pattern: /\s*Vol\.?\s*(\d+)\s*$/i, extract: (m) => m[1] },
  // Part 1, Part1
  { pattern: /\s*Part\s*(\d+)\s*$/i, extract: (m) => m[1] },
  // 第1巻, 第１巻
  { pattern: /\s*第(\d+)巻\s*$/, extract: (m) => m[1] },
  // （上）（中）（下）（1）（12）
  { pattern: /[（(]\s*([上中下]|\d+)\s*[）)]\s*$/, extract: (m) => m[1] },
  // 上巻, 中巻, 下巻
  { pattern: /\s*([上中下])巻\s*$/, extract: (m) => m[1] },
  // 末尾の単独数字: "テスト 1" （ただし年号っぽい4桁数字は除外）
  { pattern: /\s+(\d{1,3})\s*$/, extract: (m) => m[1] },
];

// ============================================================
// 副題の区切り文字
// ============================================================
const SUBTITLE_SEPARATORS = /[：:——\u2014\u2015〜～]/;

// ============================================================
// 記号除去（マッチング用の積極的な除去）
// ============================================================
function removeAllSymbols(str: string): string {
  // 日本語の記号、英語の記号、括弧類、アポストロフィ、引用符をすべて除去
  // スペースも除去
  return str.replace(
    /[\s、。，．・「」『』【】（）()\[\]{}<>《》〈〉!！?？:：;；\-\u2010-\u2015\u2018\u2019\u201C\u201D'"""''`,._~〜♪★☆◆◇■□▲△▽▼●○/／\\|＋＝]/g,
    ""
  );
}

// ============================================================
// normalizeTitle: タイトルをマッチング用に正規化
// ============================================================
export function normalizeTitle(input: string, kana?: string): NormalizedTitle {
  // 巻数・副題は元タイトル（input）から抽出する
  // 正規化のベースは kana があればそちらを使う
  let original = input.normalize("NFKC").trim();

  // 1. 丸数字を算用数字に変換（元タイトル）
  original = replaceCircledDigits(original);

  // 2. 副題の分離（元タイトルから）
  let subtitle: string | null = null;
  const subtitleIdx = original.search(SUBTITLE_SEPARATORS);
  if (subtitleIdx > 0) {
    subtitle = original.slice(subtitleIdx + 1).trim();
    original = original.slice(0, subtitleIdx).trim();
  }

  // 3. 巻数の抽出（副題分離後の元タイトルから）
  let volume: string | null = null;
  for (const { pattern, extract } of VOLUME_PATTERNS) {
    const match = original.match(pattern);
    if (match) {
      volume = extract(match);
      original = original.slice(0, match.index!).trim();
      break;
    }
  }

  // 巻数の統一（上/中/下 → 1/2/3）
  if (volume) {
    volume = normalizeVolume(volume);
  }

  // 4. 正規化ベースを決定: kana があればそちら、なければ元タイトル（巻数・副題除去済み）
  let title = kana ? kana.normalize("NFKC").trim() : original;

  // 5. ひらがな → カタカナ統一
  title = hiraganaToKatakana(title);

  // 6. 英字は大文字統一
  title = title.toUpperCase();

  // 7. 記号・スペースをすべて除去
  title = removeAllSymbols(title);

  // 副題もカタカナ化
  if (subtitle) {
    subtitle = hiraganaToKatakana(subtitle).trim();
    subtitle = removeAllSymbols(subtitle);
  }

  return {
    normalized: title,
    volume,
    subtitle,
  };
}

// ============================================================
// normalizeAuthor: 著者名をマッチング用に正規化
// ============================================================
export function normalizeAuthor(input: string, kana?: string): string {
  // 0. kana（読み仮名）が提供されている場合はそちらをベースにする
  let name = (kana || input).normalize("NFKC").trim();

  // 1. カンマ除去（"Last, First" → "Last First"、順序は変えない）
  name = name.replace(/,/g, "");

  // 2. ピリオド、中黒を除去
  name = name.replace(/[.・]/g, "");

  // 3. スペース除去
  name = name.replace(/\s+/g, "");

  // 4. 判定: 全て ASCII なら大文字化、そうでなければカタカナ化
  const isAllAscii = /^[\x00-\x7F]+$/.test(name);

  if (isAllAscii) {
    return name.toUpperCase();
  }

  // 5. ひらがな → カタカナ
  name = hiraganaToKatakana(name);

  // 6. 長音の正規化: 「ロー」リング → 「ロウ」リング
  name = normalizeLongVowel(name);

  return name;
}

// ============================================================
// 長音記号の正規化
// カタカナの「ー」を直前の文字の母音段に応じた母音文字に変換
// 例: ローリング → ロウリング
// ============================================================
const KATAKANA_VOWEL_MAP: Record<string, string> = {};

// 各行の母音を定義
const KATAKANA_ROWS: [string, string][] = [
  // [文字群, 対応する母音（ウ段はウ、オ段はウ）]
  // ア段 → ア
  ["アカサタナハマヤラワガザダバパ", "ア"],
  // イ段 → イ
  ["イキシチニヒミリギジヂビピ", "イ"],
  // ウ段 → ウ
  ["ウクスツヌフムユルグズヅブプヴ", "ウ"],
  // エ段 → イ（長音はイになることが多い）
  ["エケセテネヘメレゲゼデベペ", "イ"],
  // オ段 → ウ（長音はウになることが多い）
  ["オコソトノホモヨロゴゾドボポ", "ウ"],
];

for (const [chars, vowel] of KATAKANA_ROWS) {
  for (const ch of chars) {
    KATAKANA_VOWEL_MAP[ch] = vowel;
  }
}

function normalizeLongVowel(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "ー" && i > 0) {
      const prev = str[i - 1];
      const vowel = KATAKANA_VOWEL_MAP[prev];
      if (vowel) {
        result += vowel;
      } else {
        result += "ー";
      }
    } else {
      result += str[i];
    }
  }
  return result;
}
