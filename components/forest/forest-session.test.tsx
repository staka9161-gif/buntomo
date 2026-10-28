import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("next-auth/react", () => ({ useSession: mock.session }));
import ReadingMode from "./ReadingMode";
import ForestMap from "./ForestMap";
import { changeClassificationScope } from "./ClassificationForm";
import type { Classification } from "@/lib/literature-forest/model";

beforeEach(() => mock.session.mockReturnValue({ status: "authenticated", data: { user: { id: "A" } } }));

describe("private forest component boundaries", () => {
  it("remounts both progress/draft and map/filter state when the account changes", () => {
    expect(ReadingMode({ bookId: "book" }).key).toBe("A:book");
    expect(ForestMap({ scope: "world" }).key).toBe("A:world");
    mock.session.mockReturnValue({ status: "authenticated", data: { user: { id: "B" } } });
    expect(ReadingMode({ bookId: "book" }).key).toBe("B:book");
    expect(ForestMap({ scope: "world" }).key).toBe("B:world");
  });
  it("also resets progress when the book changes", () => {
    expect(ReadingMode({ bookId: "other-book" }).key).toBe("A:other-book");
  });
  it("does not mount private content until the session is known or after logout", () => {
    mock.session.mockReturnValue({ status: "loading", data: null });
    expect(renderToStaticMarkup(<ReadingMode bookId="book" />)).toContain("読み込み中");
    mock.session.mockReturnValue({ status: "unauthenticated", data: null });
    expect(renderToStaticMarkup(<ReadingMode bookId="book" />)).toContain('href="/login"');
    expect(renderToStaticMarkup(<ForestMap scope="world" />)).toContain('href="/login"');
  });
});

describe("classification region selection", () => {
  const world: Classification = { literatureScope: "world", countryCode: "FR", prefectureCode: null, era: "1948", mainGenreId: "fiction", subgenreIds: [], customGenreTags: [] };
  it("keeps the chosen country/prefecture when the selected scope is clicked again", () => {
    expect(changeClassificationScope(world, "world")).toBe(world);
    const japan: Classification = { ...world, literatureScope: "japan", countryCode: null, prefectureCode: "JP-26" };
    expect(changeClassificationScope(japan, "japan")).toBe(japan);
  });
  it("resets only the region fields when actually changing scope", () => {
    expect(changeClassificationScope(world, "japan")).toEqual({ ...world, literatureScope: "japan", countryCode: null, prefectureCode: null });
  });
});
