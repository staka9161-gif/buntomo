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
    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
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
        <h2 className="mb-2 text-sm font-semibold text-gray-700">レビュー</h2>
        <p className="text-sm text-gray-400">まだレビューがありません</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          レビュー ({reviews.length}件)
        </h2>
        {editionFilter && (
          <div className="flex gap-1">
            <button
              onClick={() => setFilter("all")}
              className={`rounded px-2 py-1 text-xs ${
                filter === "all"
                  ? "bg-amber-100 text-amber-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              すべての版
            </button>
            <button
              onClick={() => setFilter("edition")}
              className={`rounded px-2 py-1 text-xs ${
                filter === "edition"
                  ? "bg-amber-100 text-amber-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              選択中の版のみ
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map((review) => (
          <div key={review.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-2">
              {review.user.avatarUrl ? (
                <img
                  src={review.user.avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500">
                  {review.user.displayName[0]}
                </div>
              )}
              <span className="text-sm font-medium text-gray-700">
                {review.user.displayName}
              </span>
              {review.rating != null && (
                <span className="text-xs text-amber-500">
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                </span>
              )}
              {editionBadge(review.edition)}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{review.body}</p>
            <p className="mt-1 text-xs text-gray-400">
              {new Date(review.postedAt).toLocaleDateString("ja-JP")}
            </p>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-gray-400">この版のレビューはありません</p>
        )}
      </div>
    </div>
  );
}
