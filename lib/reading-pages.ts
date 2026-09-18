export const MAX_READING_PAGES = 100000;

export function isValidTotalPages(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_READING_PAGES;
}

export function isValidCurrentPage(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_READING_PAGES;
}
