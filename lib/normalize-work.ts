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

// ============================================================
// ローマ数字 → 算用数字マップ
// ============================================================
const ROMAN_NUMERAL_MAP: Record<string, string> = {
  "I": "1", "II": "2", "III": "3", "IV": "4", "V": "5",
  "VI": "6", "VII": "7", "VIII": "8", "IX": "9", "X": "10",
};

function romanToArabic(roman: string): string | null {
  return ROMAN_NUMERAL_MAP[roman.toUpperCase()] || null;
}

// 逆引き: 数字 → 上中下 にはしない（上中下 → 数字に統一）
function normalizeVolume(vol: string): string {
  // ローマ数字の場合
  const arabic = romanToArabic(vol);
  if (arabic) return arabic;
  return VOLUME_MAP[vol] || vol;
}

// ============================================================
// 巻数パターン（タイトル末尾から抽出）
// 優先度順に並べる。最初にマッチしたものを採用。
// ============================================================
const VOLUME_PATTERNS: { pattern: RegExp; extract: (m: RegExpMatchArray) => string }[] = [
  // BOOK1, BOOK 1, Book1
  { pattern: /\s*BOOK\s*(\d+)\s*$/i, extract: (m) => m[1] },
  // Vol.1, Vol 1 (算用数字)
  { pattern: /\s*Vol\.?\s*(\d+)\s*$/i, extract: (m) => m[1] },
  // Vol.I, Vol I, Vol.III (ローマ数字、I 含む明示パターン)
  { pattern: /\s*Vol\.?\s*(X|IX|VIII|VII|VI|IV|V|III|II|I)\s*$/i, extract: (m) => m[1] },
  // Part 1, Part1
  { pattern: /\s*Part\s*(\d+)\s*$/i, extract: (m) => m[1] },
  // 第1巻, 第１巻 (算用数字)
  { pattern: /\s*第(\d+)巻\s*$/, extract: (m) => m[1] },
  // 第I巻, 第III巻 (ローマ数字、I 含む���示パターン)
  { pattern: /\s*第(X|IX|VIII|VII|VI|IV|V|III|II|I)巻\s*$/i, extract: (m) => m[1] },
  // （上）（中）（下）（1）（12）（算用数字/上中下）
  { pattern: /[（(]\s*([上中下]|\d+)\s*[）)]\s*$/, extract: (m) => m[1] },
  // 括弧付きローマ数字: (I) (II) (III) （Ⅰ→I は NFKC で変換済み）
  // 単独 I も括弧付きなら安全に認識
  { pattern: /[（(]\s*(X|IX|VIII|VII|VI|IV|V|III|II|I)\s*[）)]\s*$/i, extract: (m) => m[1] },
  // 角括弧付き: [II] [III] [2] 【5】（単独 I は除外）
  { pattern: /[\[【]\s*(X|IX|VIII|VII|VI|IV|V|III|II|\d+)\s*[\]】]\s*$/, extract: (m) => m[1] },
  // 上巻, 中巻, 下巻
  { pattern: /\s*([上中下])巻\s*$/, extract: (m) => m[1] },
  // 修飾語（〈新装版〉〔改訂版〕等）の直前にあるローマ数字 II〜X を抽出
  // "正常化II〈新装版〉" → volume: "2"
  // 単独 I は除外。修飾語は〈〉〔〕[]（）で囲まれた部分。
  { pattern: /(?<=[^\x00-\x7F])(X|IX|VIII|VII|VI|IV|V|III|II)[〈〔\[（(][^〉〕\]）)]+[〉〕\]）)]\s*$/i, extract: (m) => m[1] },
  // 末尾ローマ数字 II〜X（スペースなしでもマッチ、ただし I は除外）
  // "基礎II" "入門III" のようなケースを拾う
  // 単語境界として: 直前が英字の場合は誤認識リスクあり（"AI" 等）なので
  // 直前が非ASCII文字（日本語）or スペースの場合のみマッチ
  { pattern: /(?<=[^\x00-\x7F]|\s)(X|IX|VIII|VII|VI|IV|V|III|II)\s*$/i, extract: (m) => m[1] },
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
// シグネチャ維持: normalizeAuthor(input, kana): string
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
// parseAuthorField: 著者フィールドから原著者・翻訳者・編者を分離
//
// 書籍データで "ドストエフスキー/亀山郁夫訳" のように
// 原著者と翻訳者が1フィールドに混在するケースを構造化する。
// ============================================================
export interface ParsedAuthorField {
  /** 原著者（1人以上） */
  authors: string[];
  /** 翻訳者（0人以上） */
  translators: string[];
  /** 編者（0人以上） */
  editors: string[];
}

export function parseAuthorField(input: string): ParsedAuthorField {
  const normalized = input.normalize("NFKC").trim();

  let authors: string[] = [];
  let translators: string[] = [];
  let editors: string[] = [];

  // --- Step 1: 括弧内の訳者を抽出して除去 ---
  // "ドストエフスキー（亀山郁夫訳）" パターン
  let remaining = normalized;
  const parenTranslatorMatch = remaining.match(/[（(]([^）)]+?)[訳翻][）)]/);
  if (parenTranslatorMatch) {
    const translatorStr = parenTranslatorMatch[1].replace(/翻訳$/, "").replace(/訳$/, "");
    translators = splitMultipleNames(translatorStr);
    remaining = remaining.replace(parenTranslatorMatch[0], "").trim();
  }

  // --- Step 2: 「名前/役割 名前/役割」形式の検出 ---
  // "村上春樹/著 ジェイ・ルービン/訳" のように各人名に /役割 がついたパターン
  const nameRoleParsed = tryParseNameRoleFormat(remaining);
  if (nameRoleParsed) {
    authors = [...authors, ...nameRoleParsed.authors];
    translators = [...translators, ...nameRoleParsed.translators];
    editors = [...editors, ...nameRoleParsed.editors];
  } else {
    // --- Step 3: スラッシュ（全角/半角）で分割 ---
    // "著者/翻訳者訳" パターン（名前/役割形式でない場合のフォールバック）
    const slashParts = remaining.split(/[/／]/);

    if (slashParts.length >= 2) {
      // スラッシュ前 = 著者部分
      const authorPart = slashParts[0].trim();
      // スラッシュ後 = 翻訳者 or その他
      const afterSlash = slashParts.slice(1).join("/").trim();

      // スラッシュ後が「〇〇訳」「〇〇翻訳」で終わる場合
      if (/[訳]$/.test(afterSlash) || /翻訳$/.test(afterSlash)) {
        const tStr = afterSlash.replace(/翻訳$/, "").replace(/訳$/, "");
        translators = [...translators, ...splitMultipleNames(tStr)];
        authors = splitAuthorsFromPart(authorPart);
      } else {
        // スラッシュだが訳ではない → 共著者扱い
        authors = [
          ...splitAuthorsFromPart(authorPart),
          ...splitAuthorsFromPart(afterSlash),
        ];
      }
    } else {
      // スラッシュなし → スペースや「著」「訳」キーワードで分離
      const parsed = parseWithKeywords(remaining);
      authors = parsed.authors;
      translators = [...translators, ...parsed.translators];
      editors = parsed.editors;
    }
  }

  // --- Step 3: 肩書の接尾辞を除去 ---
  // 著者に「編」がついていて editors が空の場合は、その人を editors に移動せず authors に残す
  // ただし「編」は除去する（「芥川龍之介編」→ authors:["芥川龍之介"]）
  authors = authors.map((a) => a.replace(/[著編]$/, "").replace(/編著$/, "").trim()).filter(Boolean);
  translators = translators.map((t) => t.replace(/訳$/, "").replace(/翻訳$/, "").trim()).filter(Boolean);
  editors = editors.map((e) => e.replace(/編$/, "").replace(/編著$/, "").trim()).filter(Boolean);

  return { authors, translators, editors };
}

// ============================================================
// 補助: 「名前/役割 名前/役割」形式の検出と分離
//
// パターン: "村上春樹/著 ジェイ・ルービン/訳"
//           "千葉康之/著 塚田真紀子/著 岡井崇/著"
//
// 各トークンの末尾が "/役割" で終わる場合にこのモードで処理。
// スペース区切りの各トークンの過半数が "/役割" を持っていれば適用。
// ============================================================

// 役割判定: 末尾キーワードで判定（複合役割 "校訂・運指・解説" にも対応）
function classifyRole(role: string): "author" | "translator" | "editor" {
  // 複合役割は末尾の役割で判定（"校訂・運指" → "運指" → 著者系）
  // ただし「訳」「翻訳」「監訳」「編訳」を含めば翻訳者
  if (/訳/.test(role) || /翻訳/.test(role)) return "translator";
  if (/^編$/.test(role) || /編著/.test(role) || /編集/.test(role) || /^他編$/.test(role)) return "editor";
  // それ以外は著者系（著, 原著, 他著, 作曲, 校訂, 校註, 解説, 監修, etc.）
  return "author";
}

// 既知の役割かどうか（tryParseNameRoleFormat の適用判定に使う）
const KNOWN_ROLES = /^(著|原著|他著|作曲|校訂|校註|注解|解説|運指|監修|補筆完成|演奏例|監|編曲|訳|翻訳|監訳|編訳|編|他編|編著|編集|総監修|日本語版監修)$/;

function tryParseNameRoleFormat(input: string): ParsedAuthorField | null {
  // 「名前/役割」パターンで分割。スペースが名前の一部の場合があるため
  // (例: "Salinger, J.D./著 野崎孝/訳")、
  // まず全ての "/役割" 位置を検出し、そこで区切る
  const nameRolePattern = /^(.+)[/／]([^/／]+)$/;

  // 戦略: 入力をスペースで分割し、"/役割" で終わるトークンを境界として
  // 前のトークンを名前の一部として結合する
  const rawTokens = input.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return null;

  // フィラーを除外
  const nonFillerTokens = rawTokens.filter((t) => t !== "ほか" && t !== "他");
  if (nonFillerTokens.length === 0) return null;

  // トークンを「名前/役割」単位に再構成
  // "/役割" で終わるトークンを見つけたら、それまでの断片を結合
  const units: string[] = [];
  let accumulator: string[] = [];

  for (const token of nonFillerTokens) {
    accumulator.push(token);
    if (nameRolePattern.test(token)) {
      // このトークンで1単位が完結
      units.push(accumulator.join(" "));
      accumulator = [];
    }
  }
  // 残りがあれば最後の単位として追加
  if (accumulator.length > 0) {
    units.push(accumulator.join(" "));
  }

  // 全 unit の過半数が「名前/役割」形式かチェック
  let matchCount = 0;
  for (const unit of units) {
    if (nameRolePattern.test(unit)) matchCount++;
  }
  if (matchCount < units.length * 0.5) return null;

  // 最低でも1つは既知役割を持つこと
  // 複合役割("校訂・運指・解説")はドット分割の末尾でも判定
  const hasKnownRole = units.some((unit) => {
    const m = unit.match(nameRolePattern);
    if (!m) return false;
    const role = m[2];
    // 複合役割の各パートを確認
    const roleParts = role.split(/[・]/);
    return roleParts.some((r) => KNOWN_ROLES.test(r.trim()));
  });
  if (!hasKnownRole) return null;

  const authors: string[] = [];
  const translators: string[] = [];
  const editors: string[] = [];

  for (const unit of units) {
    const m = unit.match(nameRolePattern);
    if (m) {
      const name = m[1].trim();
      const role = m[2].trim();
      const classification = classifyRole(role);

      if (classification === "translator") {
        translators.push(name);
      } else if (classification === "editor") {
        editors.push(name);
      } else {
        authors.push(name);
      }
    } else {
      // "/役割" なし → 著者扱い
      authors.push(unit);
    }
  }

  return { authors, translators, editors };
}

// ============================================================
// 補助: 複数人名を中黒・読点で分割（カンマは含まない）
// カンマは姓名区切りの可能性があるため別処理
// ============================================================
function splitByNakaguroOrToten(str: string): string[] {
  return str
    .split(/[・、，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ============================================================
// 補助: カンマ区切りが「姓, 名」(1人) か「著者A, 著者B」(共著) かを判定
//
// 判定基準:
// - 2パートで、各パートがスペースなしの短い文字列 → 姓名 (1人)
// - 英語: "Last, First" (パート1=1単語, パート2=1〜2単語) → 姓名
// - 日本語: 各パート 1〜4文字で2パートのみ → 姓名
// - 3パート以上 or 各パートが完全人名 → 共著者
// ============================================================
function splitByComma(str: string): string[] {
  const parts = str.split(/,/).map((s) => s.trim()).filter(Boolean);

  if (parts.length === 0) return [str];
  if (parts.length === 1) return parts;

  // 2パートの場合: 姓名か共著者かを判定
  if (parts.length === 2) {
    if (isLastFirstPattern(parts[0], parts[1])) {
      // "Last, First" → 1人として結合（順序はそのまま、スペースで結合）
      return [`${parts[0]} ${parts[1]}`];
    }
    // 共著者
    return parts;
  }

  // 3パート以上: "Smith, J., Jones, M." のようなパターンを検出
  // 偶数パートで、奇数番目が短い（イニシャルや名前）→ ペアとして結合
  if (parts.length % 2 === 0 && isAlternatingLastFirst(parts)) {
    const result: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      result.push(`${parts[i]} ${parts[i + 1]}`);
    }
    return result;
  }

  // それ以外は各パートを独立した共著者として扱う
  return parts;
}

/**
 * 2パートが「姓, 名」パターンかどうかを判定
 *
 * 判定基準:
 * - 英語: "Last, First" = 各パート1〜2単語 → 姓名
 * - 日本語: 一方が1〜2文字（姓のみ or 名のみ）→ 姓名
 *   - "巽, 孝之" (1文字, 2文字) → 姓名 ✓
 *   - "佐藤太郎, 山田花子" (4文字, 4文字) → 共著者 ✓
 *   - 両方が3文字以上は「完全人名」と判断し共著者扱い
 */
function isLastFirstPattern(part1: string, part2: string): boolean {
  // 英語: 両パートが ASCII のみ
  const isAscii1 = /^[\x20-\x7E]+$/.test(part1);
  const isAscii2 = /^[\x20-\x7E]+$/.test(part2);
  if (isAscii1 && isAscii2) {
    const words1 = part1.trim().split(/\s+/).length;
    const words2 = part2.trim().split(/\s+/).length;
    // "Gibson, William" (1, 1) or "de Beauvoir, Simone" (2, 1) → 姓名
    // "John Smith, Jane Doe" (2, 2) → 共著者（各パートが完全人名っぽい）
    if (words1 <= 3 && words2 <= 2) return true;
    return false;
  }

  // 日本語: 一方のパートが 1〜2 文字であれば「姓のみ」or「名のみ」→ 姓名
  // 両方が 3 文字以上の場合は、各パートが完全人名の可能性が高い → 共著者
  const clean1 = part1.replace(/\s/g, "");
  const clean2 = part2.replace(/\s/g, "");
  if (clean1.length <= 2 || clean2.length <= 2) {
    // 一方が短い → 姓名パターン
    return true;
  }

  return false;
}

/**
 * 偶数パートで "Last, First, Last, First, ..." パターンかを判定
 */
function isAlternatingLastFirst(parts: string[]): boolean {
  for (let i = 0; i < parts.length; i += 2) {
    if (!isLastFirstPattern(parts[i], parts[i + 1])) return false;
  }
  return true;
}

// ============================================================
// 補助: 複数人名を適切に分割（中黒/読点 + カンマの統合処理）
// ============================================================
function splitMultipleNames(str: string): string[] {
  // まず中黒・読点で分割
  const byNakaguro = splitByNakaguroOrToten(str);
  // 各パート内のカンマを処理
  const result: string[] = [];
  for (const part of byNakaguro) {
    if (part.includes(",")) {
      result.push(...splitByComma(part));
    } else {
      result.push(part);
    }
  }
  return result.filter(Boolean);
}

// ============================================================
// 補助: 著者パートから共著者を分割
// ============================================================
function splitAuthorsFromPart(part: string): string[] {
  // 「著」の除去
  const cleaned = part.replace(/著$/, "").trim();
  const split = splitMultipleNames(cleaned);
  return split.length > 0 ? split : [cleaned];
}

// ============================================================
// 補助: キーワード（著/訳/編）ベースの分離
// "カミュ著 窪田啓作訳" や "太宰治著 奥野健男編" を処理
// ============================================================
function parseWithKeywords(str: string): ParsedAuthorField {
  const authors: string[] = [];
  const translators: string[] = [];
  const editors: string[] = [];

  // "〇〇訳" が文字列末尾 or スペース前に存在するか
  // パターン: "著者名 翻訳者名訳" or "著者名著 翻訳者名訳"
  const translatorSuffixMatch = str.match(/\s+(.+?)(?:訳|翻訳)$/);
  if (translatorSuffixMatch) {
    const tStr = translatorSuffixMatch[1];
    translators.push(...splitMultipleNames(tStr));
    const authorPart = str.slice(0, translatorSuffixMatch.index!).trim();
    authors.push(...splitAuthorsFromPart(authorPart));
    return { authors, translators, editors };
  }

  // "〇〇著 〇〇編" パターン
  const editorSuffixMatch = str.match(/\s+(.+?)編$/);
  if (editorSuffixMatch) {
    const eStr = editorSuffixMatch[1];
    editors.push(...splitMultipleNames(eStr));
    const authorPart = str.slice(0, editorSuffixMatch.index!).trim();
    authors.push(...splitAuthorsFromPart(authorPart));
    return { authors, translators, editors };
  }

  // キーワードなし → splitAuthorsFromPart で適切に分割
  // splitMultipleNames 内で:
  //   - 中黒: containsJapaneseAuthorSeparator で外国人名判定
  //   - カンマ: splitByComma で姓名 vs 共著者判定
  //   - 読点: 常に共著者区切り
  if (containsJapaneseAuthorSeparator(str)) {
    authors.push(...splitAuthorsFromPart(str));
  } else {
    // セパレータなし or 姓名カンマのみ → splitAuthorsFromPart で処理
    // （splitByComma が "Last, First" を 1 人に結合してくれる）
    authors.push(...splitAuthorsFromPart(str));
  }

  return { authors, translators, editors };
}

// ============================================================
// 補助: 共著者区切りとして分割すべきセパレータが含まれるか判定
// カタカナのみ + 中黒 = 外国人名（"ヴィクトル・ユーゴー"）→ 分割しない
// 漢字を含む名前 + 中黒 = 共著者区切り（"伊坂幸太郎・阿部和重"）→ 分割
// カンマは「姓, 名」の可能性があるため splitMultipleNames 内で判定
// 読点(、)は常に共著者区切り
// ============================================================
function containsJapaneseAuthorSeparator(str: string): boolean {
  // 読点があれば必ず共著者区切り
  if (/[、，]/.test(str)) return true;

  // カンマ: splitByComma で共著者と判定される場合のみ
  if (/,/.test(str)) {
    const commaSplit = splitByComma(str);
    if (commaSplit.length >= 2) return true;
  }

  // 中黒がある場合: 中黒の両側に漢字があれば共著者区切りと判断
  if (/・/.test(str)) {
    const parts = str.split("・");
    const hasKanjiOnBothSides = parts.length >= 2 &&
      parts.every((p) => /[\u4E00-\u9FFF]/.test(p));
    return hasKanjiOnBothSides;
  }

  return false;
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
