import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TreeIllustration, { TreeCrown } from "./TreeIllustration";
import ClassificationForm from "./ClassificationForm";
import { growthLeafPosition, treeGrowthVisual } from "./tree-growth";
import {
  eraFor,
  eraLabel,
  genres,
  literaryYear,
  parseClassification,
  effectiveReadPages,
  type Classification,
} from "@/lib/literature-forest/model";

const classification: Classification = {
  literatureScope: "japan",
  countryCode: null,
  prefectureCode: "JP-26",
  era: "1948",
  mainGenreId: "fiction",
  subgenreIds: [],
  customGenreTags: [],
};
describe("genre silhouettes and five year-based foliage colors", () => {
  it("has a distinct crown for each of the 20 main genres", () => {
    const shapes = genres.map((g) =>
      renderToStaticMarkup(
        <svg>
          <TreeCrown style={g.treeStyleId} />
        </svg>,
      ),
    );
    expect(new Set(shapes).size).toBe(20);
  });
  it.each([0, 2, 200])("distinguishes genres even at %i pages", (pages) => {
    const shapes = genres.map((g) => {
      const markup = renderToStaticMarkup(
        <TreeIllustration
          pages={pages}
          classification={{ ...classification, mainGenreId: g.id }}
        />,
      );
      return [...markup.matchAll(/\s(?:d|cx|cy|rx|ry)="([^"]+)"/g)]
        .map((m) => m[0])
        .join(" ");
    });
    expect(new Set(shapes).size).toBe(20);
  });
  it("changes only leaf color when the year changes", () => {
    const years = [100, 1400, 1700, 1900, 2000];
    const colors = years.map(
      (year) => eraFor({ ...classification, era: String(year) })?.color,
    );
    expect(new Set(colors).size).toBe(5);
    const shapes = years.map((year) =>
      renderToStaticMarkup(
        <TreeIllustration
          pages={200}
          classification={{ ...classification, era: String(year) }}
        />,
      )
        .match(/\sd="[^"]+"/g)
        ?.join(" "),
    );
    expect(new Set(shapes).size).toBe(1);
    expect(
      effectiveReadPages({
        status: "READING",
        currentPage: 2,
        totalPages: 300,
      }),
    ).toBe(2);
  });
  it.each([
    [1184, "ancient"],
    [1185, "medieval"],
    [1602, "medieval"],
    [1603, "early-modern"],
    [1867, "early-modern"],
    [1868, "modern"],
    [1944, "modern"],
    [1945, "contemporary"],
  ])("maps Japanese boundary year %i to %s", (year, expected) => {
    expect(eraFor({ literatureScope: "japan", era: String(year) })?.id).toBe(
      expected,
    );
  });
  it.each([
    [499, "ancient"],
    [500, "medieval"],
    [1499, "medieval"],
    [1500, "early-modern"],
    [1799, "early-modern"],
    [1800, "modern"],
    [1944, "modern"],
    [1945, "contemporary"],
  ])("maps world boundary year %i to %s", (year, expected) => {
    expect(eraFor({ literatureScope: "world", era: String(year) })?.id).toBe(
      expected,
    );
  });
  it("preserves individual years, BCE years and legacy period IDs", () => {
    for (const era of [
      "1947",
      "1948",
      "1949",
      "-300",
      "-1",
      "1",
      "9999",
      "modern",
    ]) {
      expect(parseClassification({ ...classification, era }).era).toBe(era);
    }
    expect(literaryYear("-300")).toBe(-300);
    expect(eraLabel({ ...classification, era: "-300" })).toBe(
      "紀元前300年 · 古代",
    );
    expect(eraLabel({ ...classification, era: "modern" })).toBe(
      "近代（年未設定）",
    );
  });
  it.each(["0", "-0", "1.5", "10000", "-10000", "invalid", "01948", "1e3"])(
    "rejects invalid year %s",
    (era) => {
      expect(() => parseClassification({ ...classification, era })).toThrow();
    },
  );
  it("offers one-year inputs and a genre/color preview without requiring a fabricated legacy year", () => {
    const html = renderToStaticMarkup(
      <ClassificationForm
        initial={{ ...classification, era: "modern" }}
        onSave={async () => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('step="1"');
    expect(html).toContain('aria-label="本の年代（年）"');
    expect(html).toContain("近代（年未設定）");
    expect(html).toContain("樹形・葉色");
    expect(html).toContain("広葉樹");
  });
});

describe("visible growth at ten-page intervals", () => {
  const render = (pages: number | null) =>
    renderToStaticMarkup(
      <TreeIllustration pages={pages} classification={classification} />,
    );
  it.each([10, 20, 30, 40, 50, 100, 200, 300, 400])(
    "adds a leaf and expands the crown at %i pages",
    (pages) => {
      const before = treeGrowthVisual(pages - 1);
      const after = treeGrowthVisual(pages);
      expect(after.step).toBe(before.step + 1);
      expect(after.leafCount).toBe(before.leafCount + 1);
      expect(after.crownWidth).toBeGreaterThan(before.crownWidth);
      expect(after.crownHeight).toBeGreaterThan(before.crownHeight);
      expect(after.trunkWidth).toBeGreaterThan(before.trunkWidth);
      expect(render(pages).match(/data-growth-leaf=""/g)?.length).toBe(
        after.leafCount,
      );
    },
  );
  it("keeps a milestone's geometry stable between ten-page boundaries", () => {
    expect(treeGrowthVisual(20)).toEqual(treeGrowthVisual(29));
    expect(render(20)).toContain('data-growth-step="2"');
  });
  it("gradually grows branches and roots as well as leaves", () => {
    expect(render(20)).not.toContain('data-growth-branch=""');
    expect(render(30)).toContain('data-growth-branch=""');
    expect(render(50)).not.toContain('data-growth-root=""');
    expect(render(60)).toContain('data-growth-root=""');
  });
  it("reverses the visual milestone when a page is undone", () => {
    expect(treeGrowthVisual(19).leafCount).toBe(1);
    expect(treeGrowthVisual(20).leafCount).toBe(2);
    expect(render(19).match(/data-growth-leaf=""/g)?.length).toBe(1);
  });
  it("uses no new reading state, randomness or unbounded SVG parts", () => {
    const reading = { status: "COMPLETED", currentPage: 40, totalPages: 300 };
    const before = { ...reading };
    expect(treeGrowthVisual(effectiveReadPages(reading))).toEqual(
      treeGrowthVisual(300),
    );
    expect(reading).toEqual(before);
    expect(treeGrowthVisual(100000)).toMatchObject({
      leafCount: 48,
      branchCount: 12,
      rootCount: 6,
    });
    expect(treeGrowthVisual(100000).crownWidth).toBeLessThan(1);
    expect(growthLeafPosition(20)).toEqual(growthLeafPosition(20));
  });
  it.each([null, 0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not invent growth for %s pages",
    (pages) => {
      expect(treeGrowthVisual(pages)).toMatchObject({
        step: 0,
        leafCount: 0,
        branchCount: 0,
        rootCount: 0,
      });
    },
  );
  it("keeps clip references unique for several trees in one forest", () => {
    const html = renderToStaticMarkup(
      <div>
        {[10, 20, 30].map((pages) => (
          <TreeIllustration
            key={pages}
            pages={pages}
            classification={classification}
          />
        ))}
      </div>,
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    ids.forEach((id) => expect(html).toContain(`url(#${id})`));
  });
});
