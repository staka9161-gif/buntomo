import Link from "next/link";
import { FiBookOpen, FiExternalLink, FiSettings } from "react-icons/fi";
import {
  effectiveReadPages,
  eraFor,
  eraLabel,
  genres,
  growthStage,
  regionLabel,
  treeHeightMeters,
  treeSpecies,
  type ForestEntry,
} from "@/lib/literature-forest/model";
import TreeIllustration from "./TreeIllustration";
import styles from "./forest.module.css";

export default function ForestWorkDetails({
  tree,
}: {
  tree: ForestEntry | null;
}) {
  if (!tree)
    return (
      <div className={styles.workDetails}>
        <h2 className="font-serif text-lg">作品未選択</h2>
      </div>
    );
  const c = tree.classification;
  const genre = genres.find((g) => g.id === c?.mainGenreId);
  const pages = effectiveReadPages(tree);
  const needsSettings = !c || tree.status === "COMPLETED";
  return (
    <div className={styles.workDetails}>
      <p className="text-xs text-gray-500">
        {regionLabel(c)} · {genre?.label || "ジャンル未設定"}
      </p>
      <h2 className="mt-1 break-words font-serif text-lg font-semibold leading-snug">
        {tree.title}
      </h2>
      <p className="mt-1 break-words text-xs text-gray-600">{tree.author}</p>
      <div
        className="my-2 border-y border-[#d5e0d8] py-2 pl-2 text-sm font-medium"
        style={{ borderLeft: `3px solid ${eraFor(c)?.color || "#65796d"}` }}
      >
        {eraLabel(c)}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0">
          <TreeIllustration pages={pages} classification={c} />
        </div>
        <div className="min-w-0 text-xs leading-relaxed">
          <p>
            {tree.status === "COMPLETED" ? "読了" : "読書中"} ·{" "}
            {growthStage(pages)}
          </p>
          <p className="mt-1 tabular-nums">
            {pages ?? "未設定"} / {tree.totalPages || "未設定"}ページ
          </p>
          {pages !== null && (
            <p className="text-xs text-gray-500">
              {treeHeightMeters(pages).toFixed(2)}m
            </p>
          )}
          {genre && (
            <p className="text-xs text-gray-500">
              {treeSpecies[genre.treeStyleId]}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {c?.subgenreIds.map((id) => (
          <span key={id} className={styles.chip}>
            {genre?.groups.flatMap((g) => g.subgenres).find((s) => s.id === id)
              ?.label || id}
          </span>
        ))}
        {c?.customGenreTags.map((tag) => (
          <span key={tag} className={styles.chip}>
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={`/books/${tree.bookId}/read${needsSettings ? "?settings=1" : ""}`}
          className={`${styles.button} ${styles.primary} ${styles.detailAction}`}
        >
          {needsSettings ? <FiSettings aria-hidden /> : <FiBookOpen aria-hidden />}
          {needsSettings ? "地域・年代・ジャンル設定" : "本を開く"}
        </Link>
        <Link
          href={`/books/${tree.bookId}`}
          className="inline-flex min-h-8 items-center gap-1.5 text-xs underline"
        >
          <FiExternalLink aria-hidden />
          本ページを見る
        </Link>
        {!needsSettings && (
          <Link
            href={`/books/${tree.bookId}/read?settings=1`}
            className="inline-flex min-h-8 items-center gap-1.5 text-xs underline"
          >
            <FiSettings aria-hidden />
            地域・年代・ジャンル設定
          </Link>
        )}
      </div>
    </div>
  );
}
