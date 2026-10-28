import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { geoContains, geoMercator, geoPath } from "d3-geo";
import { mainland, stableRegionPoint, type RegionFeature } from "./geography";

describe("real map geometry", () => {
  for (const scope of ["japan", "world"]) {
    const features: RegionFeature[] = JSON.parse(
      readFileSync(`public/forest/${scope}.json`, "utf8"),
    ).features;
    it(`${scope}: region points are deterministic, inside boundaries and project to nonempty paths`, () => {
      for (const feature of features) {
        const point = stableRegionPoint(feature, "book-1");
        expect(point).toEqual(stableRegionPoint(feature, "book-1"));
        expect(
          geoContains(mainland(feature), point),
          feature.properties.code,
        ).toBe(true);
        const path = geoPath(
          geoMercator().fitSize([800, 500], mainland(feature)),
        )(mainland(feature));
        expect(path).toBeTruthy();
        expect(path).not.toContain("NaN");
      }
    });
  }
});
