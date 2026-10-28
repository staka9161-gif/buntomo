import { describe, expect, it } from "vitest";
import {
  effectiveReadPages,
  treeHeightMeters,
  growthStage,
  nextPage,
  parseClassification,
  genres,
  regions,
  matchesSubgenre,
} from "./model";

const classification = {
  literatureScope: "japan",
  prefectureCode: "JP-26",
  countryCode: null,
  era: "modern",
  mainGenreId: "fiction",
  subgenreIds: [],
  customGenreTags: [],
};
describe("forest growth uses existing personal reading data", () => {
  it("increments 0..5, resumes and undoes without an off-by-one", () => {
    const reading = { status: "READING", currentPage: 0, totalPages: 300 };
    for (let i = 0; i < 5; i++) reading.currentPage = nextPage(reading, 1);
    expect(effectiveReadPages(reading)).toBe(5);
    const resumed = JSON.parse(JSON.stringify(reading));
    resumed.currentPage = nextPage(resumed, -1);
    expect(effectiveReadPages(resumed)).toBe(4);
  });
  it("completes directly, never adds total to partial progress, and restores progress on revert", () => {
    const reading = { status: "COMPLETED", currentPage: 100, totalPages: 300 };
    expect(effectiveReadPages(reading)).toBe(300);
    expect(effectiveReadPages({ ...reading, currentPage: 0 })).toBe(300);
    expect(effectiveReadPages({ ...reading, totalPages: 320 })).toBe(320);
    expect(effectiveReadPages({ ...reading, status: "READING" })).toBe(100);
    expect(reading.currentPage).toBe(100);
  });
  it("does not invent a total for old completed records", () => {
    expect(
      effectiveReadPages({
        status: "COMPLETED",
        currentPage: 120,
        totalPages: null,
      }),
    ).toBeNull();
    expect(growthStage(null)).toBe("ページ数未設定");
  });
  it("enforces bounds and prevents completed-page edits", () => {
    expect(() =>
      nextPage({ status: "READING", currentPage: 0, totalPages: 300 }, -1),
    ).toThrow();
    expect(() =>
      nextPage({ status: "READING", currentPage: 300, totalPages: 300 }, 1),
    ).toThrow();
    expect(() =>
      nextPage({ status: "COMPLETED", currentPage: 0, totalPages: 300 }, 1),
    ).toThrow();
    expect(() =>
      nextPage({ status: "READING", currentPage: 100000, totalPages: null }, 1),
    ).toThrow();
    expect(
      effectiveReadPages({
        status: "READING",
        currentPage: 400,
        totalPages: 300,
      }),
    ).toBe(300);
  });
  it.each([
    [0, "種"],
    [1, "芽"],
    [9, "芽"],
    [10, "苗"],
    [49, "苗"],
    [50, "若木"],
    [149, "若木"],
    [150, "成木"],
    [399, "成木"],
    [400, "大樹"],
  ])("stage at %i pages", (pages, label) => {
    expect(growthStage(pages as number)).toBe(label);
  });
  it("uses the specified square-root growth curve", () => {
    expect(treeHeightMeters(0)).toBe(0);
    expect(treeHeightMeters(300)).toBeCloseTo(3.85788);
  });
});
describe("genre catalog and private per-book classification", () => {
  it("preserves all 20 genres and 592 stable subgenre IDs", () => {
    expect(genres).toHaveLength(20);
    const ids = genres.flatMap((g) =>
      g.groups.flatMap((group) => group.subgenres.map((s) => s.id)),
    );
    expect(ids).toHaveLength(592);
    expect(new Set(ids).size).toBe(592);
  });
  it("allows simultaneous fiction tags, deduplicates and has no arbitrary subgenre cap", () => {
    const all = genres[0].groups.flatMap((g) => g.subgenres);
    const picked = all.filter((s) =>
      ["純文学", "SF", "アクション"].includes(s.label),
    );
    expect(picked).toHaveLength(3);
    expect(
      parseClassification({
        ...classification,
        subgenreIds: [...picked.map((s) => s.id), picked[0].id],
      }).subgenreIds,
    ).toHaveLength(3);
    expect(
      parseClassification({
        ...classification,
        subgenreIds: all.map((s) => s.id),
      }).subgenreIds,
    ).toHaveLength(143);
  });
  it("supports partial/alias search", () => {
    const all = genres[0].groups.flatMap((g) => g.subgenres);
    expect(
      all.filter((s) => matchesSubgenre(s, "ラノベ")).map((s) => s.label),
    ).toContain("ライトノベル");
    expect(
      all.filter((s) => matchesSubgenre(s, "Sci-Fi")).map((s) => s.label),
    ).toContain("SF");
  });
  it("rejects foreign subgenre IDs, invalid locations, eras, and custom tags", () => {
    expect(() =>
      parseClassification({
        ...classification,
        subgenreIds: [genres[1].groups[0].subgenres[0].id],
      }),
    ).toThrow();
    expect(() =>
      parseClassification({ ...classification, prefectureCode: "JP-99" }),
    ).toThrow();
    expect(() =>
      parseClassification({ ...classification, era: "invalid" }),
    ).toThrow();
    expect(() =>
      parseClassification({
        ...classification,
        customGenreTags: ["x".repeat(51)],
      }),
    ).toThrow();
  });
  it("clears the inactive region and preserves custom tags separately", () => {
    const c = parseClassification({
      ...classification,
      literatureScope: "world",
      countryCode: "FR",
      customGenreTags: [" 宇宙 ", "宇宙"],
    });
    expect(c.prefectureCode).toBeNull();
    expect(c.countryCode).toBe("FR");
    expect(c.customGenreTags).toEqual(["宇宙"]);
  });
  it("has 47 prefectures and unique stable country codes", () => {
    expect(regions.japan).toHaveLength(47);
    expect(new Set(regions.world.map((r) => r.code)).size).toBe(
      regions.world.length,
    );
    expect(regions.japan.find((r) => r.code === "JP-26")?.label).toContain(
      "京都",
    );
  });
});
