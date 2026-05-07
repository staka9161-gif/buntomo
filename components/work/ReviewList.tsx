"use client";

import { useState } from "react";

interface Review {
  id: string;
  body: string;
  rating: number | null;
  postedAt: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  edition?: {
    id: string;
    format: string;
    publisher: string | null;
  } | null;
}

interface ReviewListProps {
  reviews: Review[];
  editionFilter: string | null;
}

const FORMAT_LABELS: Record<string, string> = {
  hardcover: "単行本",
  paperback: "ペーパーバック",
  bunko: "文庫",
  shinsho: "新書",
  ebook: "電子書籍",
  audiobook: "オーディオブック",
  other: "その他",
};

function editionBadge(edition?: { format: string; publisher: string | null } | null) {
  if (!edition) return null;
  const label = FORMAT_LABELS[edition.format] || edition.format;
  const text = edition.publisher ? `${label} / ${edition.publisher}` : label;
  return (
    <span className="inline-block rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-xs text-[var(--color-ink-muted)]">
      {text}版で読了
    </span>
  );
}

export default function ReviewList({ reviews, editionFilter }: ReviewListProps) {
  const [filter, setFilter] = useState<"all" | "edition">(editionFilter ? "edition" : "all");

  const filtered = filter === "edition" && editionFilter
    ? reviews.filter((r) => r.edition?.id === editionFilter)
    : reviews;

  if (reviews.length === 0) {
    return (
      <div>
        <h2 className="mb-2 font-serif text-base font-medium text-[var(--color-ink-primary)]">レビュー</h2>
        <p className="text-sm text-[var(--color-ink-faint)]">まだレビューがありません</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-base font-medium text-[var(--color-ink-primary)]">
          レビュー ({reviews.length}件)
        </h2>
        {editionFilter && (
          <div className="flex gap-1">
            <button
              onClick={() => setFilter("all")}
              className={`rounded px-2 py-1 text-xs ${
                filter === "all"
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "text-[var(--color-ink-muted)] hover:bg-[var(--color-accent-soft)]"
              }`}
            >
              すべての版
            </button>
            <button
              onClick={() => setFilter("edition")}
              className={`rounded px-2 py-1 text-xs ${
                filter === "edition"
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "text-[var(--color-ink-muted)] hover:bg-[var(--color-accent-soft)]"
              }`}
            >
              選択中の版のみ
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map((review) => (
          <div key={review.id} className="card-base p-4">
            <div className="flex items-center gap-2">
              {review.user.avatarUrl ? (
                <img
                  src={review.user.avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover shadow-[var(--shadow-cover)]"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs text-[var(--color-accent)]">
                  {review.user.displayName[0]}
                </div>
              )}
              <span className="font-serif text-sm font-medium text-[var(--color-ink-primary)]">
                {review.user.displayName}
              </span>
              {review.rating != null && (
                <span className="text-xs text-[var(--color-accent)]">
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                </span>
              )}
              {editionBadge(review.edition)}
            </div>
            <p className="mt-2 text-sm leading-[1.9] text-[var(--color-ink-primary)]">{review.body}</p>
            <p className="mt-1 text-xs font-mono text-[var(--color-ink-faint)]">
              {new Date(review.postedAt).toLocaleDateString("ja-JP")}
            </p>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-[var(--color-ink-faint)]">この版のレビューはありません</p>
        )}
      </div>
    </div>
  );
}
