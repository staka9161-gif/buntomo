import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { genres, type ForestEntry } from "@/lib/literature-forest/model";
import {
  filterForest,
  forestYearText,
  sortForestByYear,
  stripExcerpt,
  timelineTokens,
} from "./forest-catalog";
import ForestTimeline from "./ForestTimeline";
import ClassificationForm from "./ClassificationForm";
import ForestSummary from "./ForestSummary";
import ForestWorkDetails from "./ForestWorkDetails";
import ForestMapCanvas, { type ForestGeography } from "./ForestMapCanvas";
import { mapMarkerLayout } from "./map-marker-layout";

const subgenre = genres[0].groups[0].subgenres[0];
function tree(id: string, year: string, country = "FR"): ForestEntry {
  return {
    bookId: id,
    readingStatusId: "reading-" + id,
    title: "作品" + id,
    author: "著者",
    currentPage: 100,
    totalPages: 300,
    status: "COMPLETED",
    coverImageUrl: null,
    classification: {
      literatureScope: "world",
      countryCode: country,
      prefectureCode: null,
      era: year,
      mainGenreId: "fiction",
      subgenreIds: [subgenre.id],
      customGenreTags: ["自由タグ"],
    },
  };
}
const books = [
  tree("a", "2000"),
  tree("b", "-300", "GR"),
  tree("c", "1900", "DE"),
  tree("d", "modern"),
  {
    ...tree("j", "1000"),
    classification: {
      ...tree("j", "1000").classification!,
      literatureScope: "japan" as const,
      countryCode: null,
      prefectureCode: "JP-26",
    },
  },
  { ...tree("u", "0"), classification: null },
];
describe("shared forest filters, ordering and undated books", () => {
  it("keeps world, Japan and unplaced forests separate", () => {
    expect(filterForest(books, { scope: "world" })).toHaveLength(4);
    expect(
      filterForest(books, { scope: "japan" }).map((t) => t.bookId),
    ).toEqual(["j"]);
    expect(
      filterForest(books, { scope: "unplaced" }).map((t) => t.bookId),
    ).toEqual(["u"]);
  });
  it("combines country, period, official subgenre and free-text filters", () => {
    expect(
      filterForest(books, {
        scope: "world",
        region: "FR",
        era: "modern",
        subgenre: subgenre.id,
        query: "自由タグ",
      }).map((t) => t.bookId),
    ).toEqual(["d"]);
    expect(
      filterForest(books, { scope: "world", query: "ドイツ" }).map(
        (t) => t.bookId,
      ),
    ).toEqual(["c"]);
    expect(
      filterForest(books, { scope: "world", query: subgenre.label }),
    ).toHaveLength(4);
  });
  it("orders BCE and CE years, always placing missing years last without inventing years", () => {
    const source = filterForest(books, { scope: "world" });
    expect(sortForestByYear(source, "asc").map((t) => t.bookId)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(sortForestByYear(source, "desc").map((t) => t.bookId)).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
    expect(source.map((t) => t.bookId)).toEqual(["a", "b", "c", "d"]);
    expect(forestYearText(source[3])).toBe("年未設定");
    expect(forestYearText(source[1])).toBe("前300");
  });
  it("inserts era boundaries and a distinct undated section in the timeline", () => {
    const tokens = timelineTokens(
      sortForestByYear(filterForest(books, { scope: "world" }), "asc"),
    );
    expect(
      tokens.filter((t) => t.kind === "period").map((t) => t.label),
    ).toEqual(["古代", "近代", "現代", "年未設定"]);
    expect(tokens.filter((t) => t.kind === "book")).toHaveLength(4);
  });
  it("includes non-literary genres without changing their catalog or filters", () => {
    const genre = genres.find((g) => g.id !== "fiction" && g.label.includes("科学"))!;
    expect(genre).toBeDefined();
    const science = { ...books[0], classification: { ...books[0].classification!, mainGenreId: genre.id } };
    expect(filterForest([science], { scope: "world", query: genre.label })).toEqual([science]);
  });
  it("shortens only visual strip text, including non-BMP characters safely", () => {
    expect(Array.from(stripExcerpt("𠮷".repeat(100), 32))).toHaveLength(32);
    expect(Array.from(stripExcerpt("𠮷".repeat(100), 18))).toHaveLength(18);
    expect(stripExcerpt("短い題", 32)).toBe("短い題");
  });
});
describe("timeline and strip rendering", () => {
  it("keeps full titles accessible on compact chronological strips", () => {
      const book = { ...books[0], title: "非常に長い作品名".repeat(20) };
      const html = renderToStaticMarkup(
        <ForestTimeline
          trees={[book, books[3]]}
          selected={book.bookId}
          onSelect={() => {}}
        />,
      );
      expect(html).toContain(book.title);
      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain("年未設定");
      expect(html).not.toContain("年未設定年");
      expect(html).not.toContain("/books/undefined");
      expect(html).toContain("本の年表・短冊一覧");
  });
  it("uses reading-wide labels and links completed books directly to settings", () => {
    const form = renderToStaticMarkup(<ClassificationForm initial={null} onSave={async () => {}} onCancel={() => {}} />);
    const summary = renderToStaticMarkup(<ForestSummary refreshKey="test" />);
    const details = renderToStaticMarkup(<ForestWorkDetails tree={books[0]} />);
    expect(form).toContain("地域・年代・ジャンル設定");
    expect(form).not.toContain("日本文学");
    expect(form).not.toContain("世界文学");
    expect(summary).toContain("世界の読書マップ");
    expect(summary).toContain("日本の読書マップ");
    expect(summary).toContain('aria-label="読書マップ"');
    expect(summary).not.toContain("あなたの読書の森");
    expect(summary).not.toContain("<h2");
    expect(details).toContain('/books/a/read?settings=1');
    expect(details).toContain("地域・年代・ジャンル設定");
  });
});
describe("trees are visible on the map overview and inside regions", () => {
  it("separates dense region markers inside desktop and mobile map bounds", () => {
    for (const width of [360, 920]) {
      const height = width * 570 / 960;
      const layout = mapMarkerLayout(Array.from({ length: 21 }, (_, i) => ({ id: String(i), x: width / 2, y: height / 2 })), width, height);
      expect(new Set(layout.map((m) => `${m.left},${m.top}`)).size).toBe(21);
      for (const marker of layout) {
        expect(marker.left - 50 * marker.scale).toBeGreaterThanOrEqual(0);
        expect(marker.left + 50 * marker.scale).toBeLessThanOrEqual(width);
        expect(marker.top - 50 * marker.scale).toBeGreaterThanOrEqual(0);
        expect(marker.top + 50 * marker.scale).toBeLessThanOrEqual(height);
      }
    }
  });
  const world = JSON.parse(
    readFileSync("public/forest/world.json", "utf8"),
  ) as ForestGeography;
  const map = {
    ...world,
    features: world.features.filter((f) =>
      ["FR", "DE", "GR"].includes(f.properties.code),
    ),
  };
  it("renders actual tree SVGs in country markers, not just count circles", () => {
    const html = renderToStaticMarkup(
      <ForestMapCanvas
        geography={map}
        scope="world"
        trees={filterForest(books, { scope: "world" })}
        region=""
        selected="a"
        onRegionChange={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(html.match(/data-forest-region=/g)).toHaveLength(3);
    expect(html).toContain('data-tree-style="broadleaf"');
    expect(html).toContain("フランス 2本の森を開く");
    expect(html).not.toContain("foreignObject");
    expect(html).not.toContain("undefined");
  });
  it("shows only the selected country's individual trees with selection state", () => {
    const html = renderToStaticMarkup(
      <ForestMapCanvas
        geography={map}
        scope="world"
        trees={filterForest(books, { scope: "world" })}
        region="FR"
        selected="a"
        onRegionChange={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(html.match(/data-forest-book=/g)).toHaveLength(2);
    expect(html).toContain('data-forest-book="a"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('data-forest-book="c"');
  });
});
