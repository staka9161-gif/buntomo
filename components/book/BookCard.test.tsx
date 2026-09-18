import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BookCard from "./BookCard";

const props = {
  id: "book", title: "Book", author: "Author", coverImageUrl: null,
  readingId: "reading", currentPage: 100, totalPages: 250, status: "READING",
};

describe("BookCard personal pages", () => {
  it("shows personal progress and both editable page inputs", () => {
    const html = renderToStaticMarkup(<BookCard {...props} onUpdatePage={vi.fn()} />);
    expect(html).toContain("100 / 250");
    expect(html).toContain("40%");
    expect(html).toContain('value="250"');
    expect(html).toContain('aria-label="この読書記録の総ページ数"');
    expect(html).toContain('type="submit"');
  });

  it("unknown personal total remains unset and editable", () => {
    const html = renderToStaticMarkup(<BookCard {...props} totalPages={0} onUpdatePage={vi.fn()} />);
    expect(html).toContain("総ページ数未設定");
    expect(html).toContain('placeholder="未設定"');
    expect(html).not.toContain("100 / 250");
  });

  it("completed records keep the personal total and date controls", () => {
    const html = renderToStaticMarkup(<BookCard {...props} status="COMPLETED" completedAt="2026-09-18" onCompletedAtChange={() => true} />);
    expect(html).toContain("総ページ数: 250");
    expect(html).toContain("読了日を変更");
    expect(html).not.toContain('<form');
  });

  it("does not expose editing controls for another user's card", () => {
    const html = renderToStaticMarkup(<BookCard {...props} />);
    expect(html).toContain("40%");
    expect(html).not.toContain('<input');
  });
});
