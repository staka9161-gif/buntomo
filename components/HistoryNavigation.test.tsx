import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HistoryNavigation, { historyAvailability } from "./HistoryNavigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/test",
  useRouter: () => ({ back: vi.fn(), forward: vi.fn() }),
}));

describe("browser history navigation", () => {
  it.each([
    [false, false, 0],
    [true, false, 1],
    [false, true, 2],
    [true, true, 3],
  ])("reflects back=%s and forward=%s independently", (canGoBack, canGoForward, expected) => {
    expect(historyAvailability(10, { canGoBack, canGoForward })).toBe(expected);
  });

  it("does not enable either action without browser history", () => {
    expect(historyAvailability(0)).toBe(0);
    expect(historyAvailability(1)).toBe(0);
  });

  it("retains native history actions on browsers without Navigation API", () => {
    expect(historyAvailability(2)).toBe(1);
  });

  it("renders accessible non-submit buttons without accessing window during SSR", () => {
    const html = renderToStaticMarkup(<HistoryNavigation />);
    expect(html).toContain('aria-label="ページの履歴"');
    expect(html).toContain('aria-label="戻る"');
    expect(html).toContain('aria-label="進む"');
    expect(html.match(/type="button"/g)).toHaveLength(2);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).not.toContain("<a");
  });
});
