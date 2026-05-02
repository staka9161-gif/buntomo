import { normalizeAuthor } from "../lib/normalize-work";

const cases: [string, string][] = [
  ["ドストエフスキー", "ドストエフスキー/亀山郁夫訳"],
  ["村上春樹", "村上 春樹"],
  ["佐藤太郎/著 山田花子/著", "山田花子/著 佐藤太郎/著"],
];

for (const [a, b] of cases) {
  const na = normalizeAuthor(a);
  const nb = normalizeAuthor(b);
  console.log("入力A:", a);
  console.log("入力B:", b);
  console.log("正規化A:", na);
  console.log("正規化B:", nb);
  console.log("一致:", na === nb);
  console.log("---");
}
