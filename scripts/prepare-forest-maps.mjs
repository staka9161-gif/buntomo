import { mkdir, writeFile } from "node:fs/promises";

// Natural Earth v5.1.2 is public-domain cartography. Keep only display data.
const root = new URL("../", import.meta.url);
const base =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/";
const download = async (name) => {
  const response = await fetch(base + name);
  if (!response.ok) throw new Error(`Map download: ${response.status}`);
  return response.json();
};
const countries = await download("ne_50m_admin_0_countries.geojson");
const provinces = await download("ne_10m_admin_1_states_provinces.geojson");
const names = new Intl.DisplayNames(["ja"], { type: "region" });
const compact = (feature, code, label) => ({
  type: "Feature",
  properties: { code, label },
  geometry: feature.geometry,
});
const worldParts = countries.features
  .filter((f) => /^[A-Z]{2}$/.test(f.properties.ISO_A2_EH))
  .map((f) =>
    compact(f, f.properties.ISO_A2_EH, names.of(f.properties.ISO_A2_EH)),
  );
const grouped = new Map();
for (const feature of worldParts) {
  const code = feature.properties.code;
  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  const previous = grouped.get(code);
  if (previous) previous.geometry.coordinates.push(...polygons);
  else
    grouped.set(code, {
      ...feature,
      geometry: { type: "MultiPolygon", coordinates: polygons },
    });
}
const world = [...grouped.values()];
const japan = provinces.features
  .filter((f) => f.properties.adm0_a3 === "JPN")
  .map((f) => compact(f, f.properties.iso_3166_2, f.properties.name_ja));
if (
  japan.length !== 47 ||
  new Set(japan.map((f) => f.properties.code)).size !== 47
) {
  throw new Error("Expected 47 Japanese prefectures");
}
await mkdir(new URL("public/forest/", root), { recursive: true });
await mkdir(new URL("lib/literature-forest/", root), { recursive: true });
for (const [scope, features] of [
  ["world", world],
  ["japan", japan],
]) {
  await writeFile(
    new URL(`public/forest/${scope}.json`, root),
    JSON.stringify({ type: "FeatureCollection", features }, (_key, value) =>
      typeof value === "number" ? Math.round(value * 10000) / 10000 : value,
    ),
  );
}
await writeFile(
  new URL("lib/literature-forest/regions.json", root),
  JSON.stringify(
    {
      world: world
        .map((f) => f.properties)
        .sort((a, b) => a.label.localeCompare(b.label, "ja")),
      japan: japan
        .map((f) => f.properties)
        .sort((a, b) => a.code.localeCompare(b.code)),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared ${world.length} countries/territories and ${japan.length} prefectures.`,
);
