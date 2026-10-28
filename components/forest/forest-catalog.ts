import {
  eraFor,
  genres,
  literaryYear,
  normalizeGenreSearch,
  regionLabel,
  type ForestEntry,
} from "@/lib/literature-forest/model";

export type ForestScope = "japan" | "world" | "unplaced";
export type ForestFilters = {
  scope: ForestScope;
  region?: string;
  mainGenre?: string;
  subgenre?: string;
  era?: string;
  query?: string;
};
export function filterForest(trees: ForestEntry[], filters: ForestFilters) {
  const query = normalizeGenreSearch(filters.query || "");
  return trees.filter((tree) => {
    const c = tree.classification;
    const genre = genres.find((g) => g.id === c?.mainGenreId);
    const subgenreLabels =
      genre?.groups.flatMap((g) =>
        g.subgenres
          .filter((s) => c?.subgenreIds.includes(s.id))
          .map((s) => s.label),
      ) || [];
    return (
      (filters.scope === "unplaced"
        ? !c
        : c?.literatureScope === filters.scope) &&
      (!filters.region ||
        (c?.countryCode || c?.prefectureCode) === filters.region) &&
      (!filters.mainGenre || c?.mainGenreId === filters.mainGenre) &&
      (!filters.subgenre || c?.subgenreIds.includes(filters.subgenre)) &&
      (!filters.era || (eraFor(c)?.id || "unclassified") === filters.era) &&
      (!query ||
        normalizeGenreSearch(
          [
            tree.title,
            tree.author,
            regionLabel(c),
            genre?.label || "",
            ...subgenreLabels,
            ...(c?.customGenreTags || []),
          ].join(" "),
        ).includes(query))
    );
  });
}
export function sortForestByYear(trees: ForestEntry[], order: "asc" | "desc") {
  return [...trees].sort((a, b) => {
    const ay = literaryYear(a.classification?.era || "");
    const by = literaryYear(b.classification?.era || "");
    if (ay === null && by !== null) return 1;
    if (ay !== null && by === null) return -1;
    if (ay !== null && by !== null && ay !== by)
      return (ay - by) * (order === "asc" ? 1 : -1);
    return (
      a.title.localeCompare(b.title, "ja") || a.bookId.localeCompare(b.bookId)
    );
  });
}
export function forestYearText(tree: ForestEntry) {
  const year = literaryYear(tree.classification?.era || "");
  return year === null ? "年未設定" : year < 0 ? `前${-year}` : String(year);
}
export type TimelineToken =
  | { kind: "period"; key: string; label: string; color: string }
  | { kind: "book"; tree: ForestEntry };
export function timelineTokens(trees: ForestEntry[]): TimelineToken[] {
  const tokens: TimelineToken[] = [];
  let previous = "";
  for (const tree of trees) {
    const era = eraFor(tree.classification);
    const undated = literaryYear(tree.classification?.era || "") === null;
    const key = undated ? "undated" : era?.id || "unclassified";
    if (key !== previous) {
      tokens.push({
        kind: "period",
        key: `${key}:${tree.bookId}`,
        label: undated ? "年未設定" : era?.label || "時代未設定",
        color: undated ? "#83918a" : era?.color || "#83918a",
      });
      previous = key;
    }
    tokens.push({ kind: "book", tree });
  }
  return tokens;
}
export function stripExcerpt(value: string, max: number) {
  const letters = Array.from(value);
  return letters.length > max
    ? letters.slice(0, max - 1).join("") + "…"
    : value;
}
