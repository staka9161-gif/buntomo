import { geoArea, geoBounds, geoContains, geoCentroid } from "d3-geo";
import type { Feature, Polygon, MultiPolygon } from "geojson";

export type RegionFeature = Feature<
  Polygon | MultiPolygon,
  { code: string; label: string }
>;
export function mainland(feature: RegionFeature): RegionFeature {
  if (feature.geometry.type === "Polygon") return feature;
  const polygons = feature.geometry.coordinates.map((coordinates) => ({
    ...feature,
    geometry: { type: "Polygon" as const, coordinates },
  }));
  return polygons.reduce((a, b) => (geoArea(a) > geoArea(b) ? a : b));
}
export function stableRegionPoint(
  feature: RegionFeature,
  bookId: string,
): [number, number] {
  const area = mainland(feature);
  let seed = 2166136261;
  for (const c of bookId) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const [[west, south], [east, north]] = geoBounds(area);
  const width = east >= west ? east - west : 360 + east - west;
  for (let i = 0; i < 4096; i++) {
    let longitude = west + width * random();
    if (longitude > 180) longitude -= 360;
    const point: [number, number] = [
      longitude,
      south + (north - south) * random(),
    ];
    if (geoContains(area, point)) return point;
  }
  const center = geoCentroid(area);
  if (geoContains(area, center)) return center;
  // A vertex is a stable boundary fallback for very thin polygons.
  const coordinates = area.geometry as Polygon;
  return coordinates.coordinates[0][0].slice(0, 2) as [number, number];
}
