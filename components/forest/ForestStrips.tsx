"use client";

import type { CSSProperties } from "react";
import {
  eraFor,
  genres,
  regionLabel,
  type ForestEntry,
} from "@/lib/literature-forest/model";
import { forestYearText, stripExcerpt } from "./forest-catalog";
import styles from "./forest.module.css";

export function WorkStrip({
  tree,
  selected,
  onSelect,
}: {
  tree: ForestEntry;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const genre = genres.find((g) => g.id === tree.classification?.mainGenreId);
  const color = eraFor(tree.classification)?.color || "#83918a";
  const year = forestYearText(tree);
  return (
    <button
      type="button"
      aria-label={`${year === "年未設定" ? year : year + "年"}・${tree.title}・${tree.author}の詳細`}
      aria-pressed={selected}
      onClick={() => onSelect(tree.bookId)}
      className={`${styles.workStrip} ${selected ? styles.workStripSelected : ""}`}
      style={{ "--era-color": color } as CSSProperties}
      title={`${tree.title} / ${tree.author}`}
    >
      <span className={styles.stripRegion} title={regionLabel(tree.classification)}>
        {stripExcerpt(regionLabel(tree.classification), 8)}
      </span>
      <span className={styles.stripColumns} aria-hidden="true">
        <span className={styles.stripTitle}>
          {stripExcerpt(tree.title, 18)}
        </span>
        <span className={styles.stripAuthor}>
          {stripExcerpt(tree.author, 24)}
        </span>
      </span>
      <span className={styles.stripGenre} title={genre?.label || "ジャンル未設定"}>
        {stripExcerpt(genre?.label || "ジャンル未設定", 8)}
      </span>
      <span className={styles.stripStatus}>
        {tree.status === "COMPLETED" ? "読了" : "読書中"}
      </span>
    </button>
  );
}
