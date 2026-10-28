import catalogData from "./genres.json";
import regions from "./regions.json";
import { MAX_READING_PAGES } from "@/lib/reading-pages";

export type Subgenre = { id: string; label: string; aliases?: string[] };
export type Genre = {
  id: string;
  label: string;
  treeStyleId: string;
  groups: { label: string; subgenres: Subgenre[] }[];
};
export const genres: Genre[] = catalogData.mainGenres;
export const catalogVersion = catalogData.schemaVersion;
export { regions };
export const eras = [
  { id: "ancient", label: "古代", color: "#7D9970" },
  { id: "medieval", label: "中世", color: "#6D9281" },
  { id: "early-modern", label: "近世", color: "#8BAF64" },
  { id: "modern", label: "近代", color: "#C69B4E" },
  { id: "contemporary", label: "現代", color: "#9D83BA" },
];
export const treeSpecies: Record<string, string> = {
  broadleaf: "広葉樹",
  maple: "カエデ",
  conifer: "針葉樹",
  ginkgo: "イチョウ",
  beech: "ブナ",
  zelkova: "ケヤキ",
  hinoki: "ヒノキ",
  pine: "マツ",
  sacred: "神木",
  birch: "シラカバ",
  redwood: "セコイア",
  metasequoia: "メタセコイア",
  olive: "オリーブ",
  flowering: "花木",
  jacaranda: "ジャカランダ",
  fruit: "果樹",
  palm: "ヤシ",
  willow: "シダレヤナギ",
  poplar: "ポプラ",
  default: "標準樹形",
};
export function literaryYear(era: string): number | null {
  return /^-?[1-9]\d{0,3}$/.test(era) ? Number(era) : null;
}
export function eraFor(
  classification: Pick<Classification, "era" | "literatureScope"> | null,
) {
  if (!classification) return null;
  const year = literaryYear(classification.era);
  if (year === null)
    return eras.find((e) => e.id === classification.era) || null;
  // Display-only periods, not a claim that historical boundaries are universal.
  const starts =
    classification.literatureScope === "japan"
      ? [1185, 1603, 1868, 1945]
      : [500, 1500, 1800, 1945];
  const index = starts.findIndex((start) => year < start);
  return eras[index === -1 ? 4 : index];
}
export function eraLabel(
  classification: Pick<Classification, "era" | "literatureScope"> | null,
): string {
  const era = eraFor(classification);
  if (!era || !classification) return "時代未設定";
  const year = literaryYear(classification.era);
  return year === null
    ? `${era.label}（年未設定）`
    : `${year < 0 ? `紀元前${-year}` : `西暦${year}`}年 · ${era.label}`;
}
export type Classification = {
  literatureScope: "japan" | "world";
  countryCode: string | null;
  prefectureCode: string | null;
  era: string;
  mainGenreId: string;
  subgenreIds: string[];
  customGenreTags: string[];
};
export type Progress = {
  status: string;
  currentPage: number;
  totalPages: number | null;
};
export type ForestEntry = Progress & {
  bookId: string;
  readingStatusId: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  classification: Classification | null;
};

export function effectiveReadPages(reading: Progress): number | null {
  const total =
    reading.totalPages && reading.totalPages > 0 ? reading.totalPages : null;
  if (reading.status === "COMPLETED") return total;
  const current = Math.max(0, Math.floor(reading.currentPage));
  return total === null ? current : Math.min(current, total);
}
export function treeHeightMeters(pages: number): number {
  const count = Math.max(0, Math.floor(pages));
  return count === 0 ? 0 : 1 + 0.165 * Math.sqrt(count);
}
export function growthStage(pages: number | null): string {
  if (pages === null) return "ページ数未設定";
  return pages === 0
    ? "種"
    : pages < 10
      ? "芽"
      : pages < 50
        ? "苗"
        : pages < 150
          ? "若木"
          : pages < 400
            ? "成木"
            : "大樹";
}
export function nextPage(reading: Progress, delta: number): number {
  if (reading.status !== "READING")
    throw new Error("読みかけの本だけ進められます");
  if (delta !== 1 && delta !== -1) throw new Error("ページ操作が不正です");
  const next = reading.currentPage + delta;
  const limit =
    reading.totalPages && reading.totalPages > 0
      ? reading.totalPages
      : MAX_READING_PAGES;
  if (next < 0 || next > limit) {
    throw new Error("ページ数の範囲を超えています");
  }
  return next;
}
export function normalizeGenreSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s\-ー]/g, "");
}
export function matchesSubgenre(item: Subgenre, query: string): boolean {
  const q = normalizeGenreSearch(query);
  return [item.label, ...(item.aliases || [])].some((s) =>
    normalizeGenreSearch(s).includes(q),
  );
}
export function parseClassification(value: unknown): Classification {
  if (!value || typeof value !== "object")
    throw new Error("分類を選択してください");
  const input = value as Record<string, unknown>;
  const scope = input.literatureScope;
  if (scope !== "japan" && scope !== "world")
    throw new Error("地域の区分を選択してください");
  const code = scope === "japan" ? input.prefectureCode : input.countryCode;
  if (!regions[scope].some((r) => r.code === code))
    throw new Error("国・地域を選択してください");
  if (
    typeof input.era !== "string" ||
    (!eras.some((e) => e.id === input.era) && literaryYear(input.era) === null)
  )
    throw new Error("時代は1〜9999年の整数で指定してください");
  const genre = genres.find((g) => g.id === input.mainGenreId);
  if (!genre) throw new Error("大ジャンルを選択してください");
  const allowed = new Set(
    genre.groups.flatMap((g) => g.subgenres.map((s) => s.id)),
  );
  if (
    !Array.isArray(input.subgenreIds) ||
    input.subgenreIds.some((id) => typeof id !== "string" || !allowed.has(id))
  ) {
    throw new Error("選択した大ジャンルに属さないサブジャンルです");
  }
  const custom = input.customGenreTags ?? [];
  if (
    !Array.isArray(custom) ||
    custom.length > 30 ||
    custom.some(
      (tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 50,
    )
  ) {
    throw new Error("自由タグは各50文字以内・30個以内で入力してください");
  }
  return {
    literatureScope: scope,
    countryCode: scope === "world" ? (code as string) : null,
    prefectureCode: scope === "japan" ? (code as string) : null,
    era: input.era as string,
    mainGenreId: genre.id,
    subgenreIds: [...new Set(input.subgenreIds)].sort(),
    customGenreTags: [
      ...new Set((custom as string[]).map((tag) => tag.trim())),
    ].sort(),
  };
}
export function regionLabel(classification: Classification | null): string {
  if (!classification) return "植える場所が未設定";
  return (
    regions[classification.literatureScope].find(
      (r) =>
        r.code ===
        (classification.countryCode || classification.prefectureCode),
    )?.label || "植える場所が未設定"
  );
}
