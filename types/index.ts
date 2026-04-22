export type WindowType = "1d" | "1w" | "all";

export const WINDOW_LABELS: Record<WindowType, string> = {
  "1d": "読み終えた感想（24時間以内）",
  "1w": "1週間",
  "all": "無期限",
};

export function windowToMs(window: WindowType): number {
  const day = 24 * 60 * 60 * 1000;
  switch (window) {
    case "1d": return day;
    case "1w": return 7 * day;
    case "all": return 100 * 365 * day;
  }
}

export function calculateProgress(currentPage: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.floor((currentPage / totalPages) * 100);
}
