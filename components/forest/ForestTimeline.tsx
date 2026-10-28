"use client";

import type { CSSProperties } from "react";
import { eraFor, type ForestEntry } from "@/lib/literature-forest/model";
import { forestYearText, timelineTokens } from "./forest-catalog";
import { WorkStrip } from "./ForestStrips";
import styles from "./forest.module.css";

export default function ForestTimeline({
  trees,
  selected,
  onSelect,
}: {
  trees: ForestEntry[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className={styles.timeline} aria-label="本の年表・短冊一覧">
      {timelineTokens(trees).map((token) => {
        if (token.kind === "period")
          return (
            <li
              key={token.key}
              className={styles.timelinePeriod}
              style={{ "--era-color": token.color } as CSSProperties}
            >
              <span className={styles.timelineYear}>年代</span>
              <span className={styles.timelineAxis}>
                <span />
              </span>
              <span className={styles.periodName}>{token.label}</span>
            </li>
          );
        const { tree } = token;
        return (
          <li
            key={tree.bookId}
            className={styles.timelineItem}
            style={
              {
                "--era-color": eraFor(tree.classification)?.color || "#83918a",
              } as CSSProperties
            }
          >
            <span className={styles.timelineYear}>{forestYearText(tree)}</span>
            <span className={styles.timelineAxis} aria-hidden="true">
              <span />
            </span>
            <WorkStrip
              tree={tree}
              selected={tree.bookId === selected}
              onSelect={onSelect}
            />
          </li>
        );
      })}
    </ol>
  );
}
