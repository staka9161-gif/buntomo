"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoNaturalEarth1, geoPath } from "d3-geo";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import {
  effectiveReadPages,
  treeHeightMeters,
  type ForestEntry,
} from "@/lib/literature-forest/model";
import { mainland, stableRegionPoint } from "@/lib/literature-forest/geography";
import TreeIllustration from "./TreeIllustration";
import { mapMarkerLayout } from "./map-marker-layout";
import styles from "./forest.module.css";

export type ForestGeography = FeatureCollection<
  Polygon | MultiPolygon,
  { code: string; label: string }
>;
export default function ForestMapCanvas({
  geography,
  scope,
  trees,
  region,
  selected,
  onRegionChange,
  onSelect,
}: {
  geography: ForestGeography;
  scope: "world" | "japan";
  trees: ForestEntry[];
  region: string;
  selected: string;
  onRegionChange: (region: string) => void;
  onSelect: (bookId: string) => void;
}) {
  const plane = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  useEffect(() => {
    const element = plane.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const feature = geography.features.find((f) => f.properties.code === region);
  const projection = useMemo(() => {
    if (feature)
      return geoMercator().fitExtent(
        [
          [90, 80],
          [870, 525],
        ],
        mainland(feature),
      );
    return (scope === "world" ? geoNaturalEarth1() : geoMercator()).fitExtent(
      [
        [30, 70],
        [930, 530],
      ],
      geography,
    );
  }, [feature, scope, geography]);
  const path = geoPath(projection);
  const groups = new Map<string, ForestEntry[]>();
  trees.forEach((tree) => {
    const c = tree.classification;
    const code = c?.countryCode || c?.prefectureCode;
    if (code) groups.set(code, [...(groups.get(code) || []), tree]);
  });
  const height = width * 570 / 960;
  const markers = mapMarkerLayout(geography.features.flatMap((f) => {
    if (!groups.has(f.properties.code)) return [];
    const point = projection(stableRegionPoint(f, "forest-center"));
    return point ? [{ id: f.properties.code, x: point[0] * width / 960, y: point[1] * height / 570 }] : [];
  }), width, height);
  return (
    <div className={styles.mapCanvas}>
      <div ref={plane} className={styles.mapPlane}>
        <svg
          viewBox="0 0 960 570"
          className={styles.mapSvg}
          aria-label={
            feature
              ? `${feature.properties.label}の地図`
              : scope === "japan"
                ? "日本の読書マップ"
                : "世界の読書マップ"
          }
        >
          {geography.features.map((f) => (
            <path
              key={f.properties.code}
              d={path(f) || ""}
              className={`${styles.region} ${f.properties.code === region || groups.has(f.properties.code) ? styles.regionActive : ""}`}
              role="button"
              tabIndex={groups.has(f.properties.code) && !region ? 0 : -1}
              aria-label={`${f.properties.label} ${groups.get(f.properties.code)?.length || 0}本`}
              onClick={() => onRegionChange(f.properties.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRegionChange(f.properties.code);
                }
              }}
            >
              <title>{f.properties.label}</title>
            </path>
          ))}
          {!feature && markers.map((marker) => (
            <g key={marker.id} className={styles.mapLeader} aria-hidden="true">
              <line x1={marker.x * 960 / width} y1={marker.y * 570 / height} x2={marker.left * 960 / width} y2={marker.top * 570 / height} />
              <circle cx={marker.x * 960 / width} cy={marker.y * 570 / height} r="2.5" />
            </g>
          ))}
        </svg>
        <div className={styles.mapMarkers}>
          {!feature &&
            markers.map((marker) => {
                const f = geography.features.find((f) => f.properties.code === marker.id)!;
                const books = [...groups.get(f.properties.code)!].sort((a, b) =>
                  a.bookId.localeCompare(b.bookId),
                );
                const representatives = books.slice(0, 3);
                return (
                  <button
                    key={f.properties.code}
                    type="button"
                    data-forest-region={f.properties.code}
                    className={styles.forestMarker}
                    style={{
                      left: `${(marker.left / width) * 100}%`,
                      top: `${(marker.top / height) * 100}%`,
                      transform: `translate(-50%, -50%) scale(${marker.scale})`,
                    }}
                    aria-label={`${f.properties.label} ${books.length}本の森を開く`}
                    onClick={() => onRegionChange(f.properties.code)}
                  >
                    <span className={styles.markerTrees} aria-hidden="true">
                      {representatives.map((tree, index) => (
                        <span
                          key={tree.bookId}
                          className={styles.markerTree}
                          style={{
                            left: `${(index - (representatives.length - 1) / 2) * 15}px`,
                          }}
                        >
                          <TreeIllustration
                            pages={effectiveReadPages(tree)}
                            classification={tree.classification}
                          />
                        </span>
                      ))}
                    </span>
                    <span className={styles.markerCount}>{books.length}</span>
                    <span className={styles.markerRegion}>
                      {f.properties.label}
                    </span>
                  </button>
                );
              })}
          {feature &&
            (groups.get(feature.properties.code) || []).map((tree) => {
              const point = projection(stableRegionPoint(feature, tree.bookId));
              if (!point) return null;
              const size = Math.min(
                104,
                66 + treeHeightMeters(effectiveReadPages(tree) || 0) * 6,
              );
              return (
                <button
                  key={tree.bookId}
                  type="button"
                  data-forest-book={tree.bookId}
                  className={`${styles.bookMarker} ${selected === tree.bookId ? styles.bookMarkerSelected : ""}`}
                  style={{
                    left: `${(point[0] / 960) * 100}%`,
                    top: `${(point[1] / 570) * 100}%`,
                    width: size,
                  }}
                  aria-label={`${tree.title}の木`}
                  aria-pressed={selected === tree.bookId}
                  onClick={() => onSelect(tree.bookId)}
                >
                  <TreeIllustration
                    pages={effectiveReadPages(tree)}
                    classification={tree.classification}
                  />
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
