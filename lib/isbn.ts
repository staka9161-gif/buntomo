import { isbn10to13, isbn13to10 } from "./normalize";

/** Validate the check digit before accepting an ISBN for an exact lookup. */
export function normalizeLookupIsbn(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 128) return null;
  const isbn = input.normalize("NFKC").trim()
    .replace(/^ISBN(?:-1[03])?\s*:?\s*/i, "")
    .replace(/[\s\-\u2010-\u2015\u2212]/g, "").toUpperCase();

  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, i) =>
      total + (digit === "X" ? 10 : Number(digit)) * (10 - i), 0);
    return sum % 11 === 0 ? isbn10to13(isbn) : null;
  }
  if (/^97[89]\d{10}$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, i) =>
      total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0 ? isbn : null;
  }
  return null;
}

export function isbnVariants(isbn13: string): string[] {
  const isbn10 = isbn13to10(isbn13);
  return isbn10 ? [isbn13, isbn10] : [isbn13];
}
