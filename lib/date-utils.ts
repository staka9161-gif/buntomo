/**
 * クライアントから送られた日時文字列をDateオブジェクトに変換
 * タイムゾーン情報がない場合はJST（UTC+9）として解釈
 */
export function parseEventDate(dateStr: string): Date {
  // ISO文字列（Zまたは+付き）はそのままパース
  if (dateStr.includes("Z") || dateStr.includes("+") || /T\d{2}:\d{2}:\d{2}[.-]/.test(dateStr)) {
    return new Date(dateStr);
  }
  // タイムゾーンなし（datetime-local形式）→ JSTとして解釈
  // "2026-04-25T15:00" → "2026-04-25T15:00:00+09:00"
  return new Date(dateStr + ":00+09:00");
}
