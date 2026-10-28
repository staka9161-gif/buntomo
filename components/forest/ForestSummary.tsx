"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiGlobe, FiMap } from "react-icons/fi";
import { apiUrl } from "@/lib/api";
import type { ForestEntry } from "@/lib/literature-forest/model";
import styles from "./forest.module.css";

export default function ForestSummary({ refreshKey }: { refreshKey: string }) {
  const [unplaced, setUnplaced] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl("/api/me/literature-forest"), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: { trees: ForestEntry[] }) =>
        setUnplaced(data.trees.filter((t) => !t.classification).length),
      )
      .catch(() => {
        if (!controller.signal.aborted) setUnplaced(null);
      });
    return () => controller.abort();
  }, [refreshKey]);
  return (
    <section
      aria-label="読書マップ"
      className={`${styles.surface} mb-6 border-y border-[var(--color-border-subtle)] py-4`}
    >
      <div className={styles.summaryLinks}>
        <Link
          href="/mypage/forest/world"
          className={`${styles.button} ${styles.summaryLink}`}
        >
          <FiGlobe aria-hidden />
          世界の読書マップ
        </Link>
        <Link
          href="/mypage/forest/japan"
          className={`${styles.button} ${styles.summaryLink}`}
        >
          <FiMap aria-hidden />
          日本の読書マップ
        </Link>
      </div>
      {(unplaced === null || unplaced > 0) && (
        <Link
          href="/mypage/forest/unplaced"
          className="mt-3 inline-block py-1 text-sm underline"
        >
          地域未設定の本{unplaced !== null && `（${unplaced}冊）`}
        </Link>
      )}
    </section>
  );
}
