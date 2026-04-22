// ============================================================
// 文字列・ISBN正規化ユーティリティ
// ============================================================

/**
 * NFKC正規化 + 追加の日本語向け正規化
 * - 全角英数 → 半角
 * - 全角スペース → 半角スペース
 * - 長音記号の統一
 * - 前後空白トリム
 */
export function normalizeText(text: string): string {
  let s = text.normalize("NFKC");
  // 長音記号統一（−, ―, ‐, ─ → ー）
  s = s.replace(/[−―‐─\u2010\u2011\u2012\u2013\u2014\u2015]/g, "ー");
  // 連続スペースを1つに
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

/**
 * カタカナ → ひらがな変換
 */
export function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/**
 * ひらがな → カタカナ変換
 */
export function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

/**
 * 検索用に記号を除去した文字列を生成
 */
export function removeSymbols(text: string): string {
  // 句読点、括弧、記号類を除去（スペースは残す）
  return text.replace(/[、。，．・「」『』【】（）()[\]{}《》〈〉!！?？:：;；\-]/g, "");
}

/**
 * 検索クエリをトークナイズ（スペース区切り、各トークンをAND条件として扱う）
 */
export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeText(query);
  return normalized.split(/\s+/).filter((t) => t.length > 0);
}

// ============================================================
// ISBN正規化
// ============================================================

/**
 * ISBNからハイフン・スペースを除去
 */
export function cleanIsbn(isbn: string): string {
  return isbn.replace(/[-\s]/g, "");
}

/**
 * ISBN-10のチェックディジットを計算
 */
function isbn10CheckDigit(isbn9: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn9[i]) * (10 - i);
  }
  const remainder = (11 - (sum % 11)) % 11;
  return remainder === 10 ? "X" : String(remainder);
}

/**
 * ISBN-13のチェックディジットを計算
 */
function isbn13CheckDigit(isbn12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(isbn12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * ISBN-10 → ISBN-13 変換
 */
export function isbn10to13(isbn10: string): string | null {
  const clean = cleanIsbn(isbn10);
  if (clean.length !== 10) return null;
  const isbn12 = "978" + clean.slice(0, 9);
  return isbn12 + isbn13CheckDigit(isbn12);
}

/**
 * ISBN-13 → ISBN-10 変換（978プレフィックスのみ）
 */
export function isbn13to10(isbn13: string): string | null {
  const clean = cleanIsbn(isbn13);
  if (clean.length !== 13 || !clean.startsWith("978")) return null;
  const isbn9 = clean.slice(3, 12);
  return isbn9 + isbn10CheckDigit(isbn9);
}

/**
 * ISBNを正規化してISBN-13形式で返す
 */
export function normalizeIsbn(isbn: string): string | null {
  const clean = cleanIsbn(isbn);
  if (clean.length === 13 && /^\d{13}$/.test(clean)) return clean;
  if (clean.length === 10 && /^\d{9}[\dXx]$/.test(clean)) return isbn10to13(clean);
  return null;
}

/**
 * ISBNっぽい入力かどうか判定
 */
export function isIsbnLike(query: string): boolean {
  const clean = cleanIsbn(query);
  return /^\d{10,13}$/.test(clean) || /^\d{9}X$/i.test(clean);
}

// ============================================================
// 出版社・レーベル正規化
// ============================================================

/**
 * 出版社名を正規化
 * - (株), 株式会社, ㈱ 等を除去
 * - NFKC正規化
 * - 前後空白トリム
 */
export function normalizePublisher(publisher: string): string {
  let s = publisher.normalize("NFKC");
  s = s.replace(/[（(]?株式会社[）)]?/g, "");
  s = s.replace(/[（(]?有限会社[）)]?/g, "");
  s = s.replace(/[（(]株[）)]|㈱/g, "");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

/**
 * タイトルからレーベル名を抽出
 * 例: "ノルウェイの森（講談社文庫）" → { title: "ノルウェイの森", label: "講談社文庫" }
 */
export function extractLabel(title: string): { title: string; label: string | null } {
  // 末尾の括弧内のレーベル名を抽出 (文庫|新書|ブックス|選書|ライブラリー を含む場合)
  const patterns = [
    /[（(]([^）)]*(?:文庫|新書|ブックス|選書|ライブラリー|ブルーバックス)[^）)]*)[）)]\s*$/,
    /\s*[（(]([^）)]+社[^）)]*)[）)]\s*$/,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const label = match[1].trim();
      const cleanTitle = title.replace(match[0], "").trim();
      return { title: cleanTitle, label };
    }
  }

  return { title, label: null };
}
