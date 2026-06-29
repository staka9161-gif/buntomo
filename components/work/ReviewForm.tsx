"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";

type ReviewVisibility = "public" | "friends" | "private";

interface ExistingReview {
  id: string;
  body: string;
  rating: number | null;
  visibility: ReviewVisibility;
  isSpoiler: boolean;
}

interface ReviewFormProps {
  workId: string;
  editionId: string | null;
  isLoggedIn: boolean;
  existingReview: ExistingReview | null;
  defaultVisibility: ReviewVisibility;
  onSubmitted: () => void;
}

export default function ReviewForm({
  workId,
  editionId,
  isLoggedIn,
  existingReview,
  defaultVisibility,
  onSubmitted,
}: ReviewFormProps) {
  const [body, setBody] = useState(existingReview?.body ?? "");
  const [rating, setRating] = useState<number | null>(existingReview?.rating ?? null);
  const [visibility, setVisibility] = useState<ReviewVisibility>(existingReview?.visibility ?? defaultVisibility);
  const [isSpoiler, setIsSpoiler] = useState(existingReview?.isSpoiler ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) return null;

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/works/${workId}/reviews`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edition_id: editionId,
          body: body.trim(),
          rating,
          visibility,
          isSpoiler,
        }),
      });
      if (res.ok) {
        onSubmitted();
      } else {
        const data = await res.json();
        setError(data.error || "送信に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReview) return;
    if (!confirm("この読了メモ・感想を削除しますか？")) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/works/${workId}/reviews`), {
        method: "DELETE",
      });
      if (res.ok) {
        setBody("");
        setRating(null);
        setVisibility(defaultVisibility);
        setIsSpoiler(false);
        onSubmitted();
      } else {
        const data = await res.json();
        setError(data.error || "削除に失敗しました");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-4 card-base p-5">
      <h3 className="mb-2 font-serif text-base font-medium tracking-[0.05em] text-[var(--color-ink-primary)]">読了メモ・感想を書く</h3>

      {/* 星評価 */}
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(rating === n ? null : n)}
            className={`text-xl ${n <= (rating ?? 0) ? "text-[var(--color-accent)]" : "text-[var(--color-ink-faint)]"} hover:text-[var(--color-accent)]`}
          >
            ★
          </button>
        ))}
        {rating && (
          <button onClick={() => setRating(null)} className="ml-1 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink-primary)]">
            クリア
          </button>
        )}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="読了後に残しておきたいメモや、この作品の感想を書いてください..."
        className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] p-3 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
        rows={3}
      />

      <fieldset className="mt-3">
        <legend className="mb-2 text-xs font-medium tracking-[0.05em] text-[var(--color-ink-muted)]">
          公開範囲
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { value: "public", label: "公開", description: "だれでも見ることができます" },
            { value: "friends", label: "友だちのみ", description: "友だちだけが見ることができます" },
            { value: "private", label: "非公開", description: "自分だけが見ることができます" },
          ].map((option) => (
            <label
              key={option.value}
              className={`rounded border px-3 py-2 text-sm ${
                visibility === option.value
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]"
              }`}
            >
              <span className="flex items-center gap-2 font-medium text-[var(--color-ink-primary)]">
                <input
                  type="radio"
                  name="review-visibility"
                  value={option.value}
                  checked={visibility === option.value}
                  onChange={() => setVisibility(option.value as ReviewVisibility)}
                />
                {option.label}
              </span>
              <span className="mt-1 block text-xs text-[var(--color-ink-muted)]">
                {option.description}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 flex items-start gap-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={isSpoiler}
          onChange={(e) => setIsSpoiler(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-medium text-[var(--color-ink-primary)]">ネタバレを含む</span>
          <span className="block text-xs text-[var(--color-ink-muted)]">
            ネタバレありにすると、他の人には内容が隠された状態で表示されます。
          </span>
        </span>
      </label>

      {error && <p className="mt-1 text-xs text-[var(--color-accent)]">{error}</p>}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {existingReview && (
          <button
            onClick={handleDelete}
            disabled={submitting || deleting}
            className="btn-secondary-sm disabled:opacity-50"
          >
            {deleting ? "削除中..." : "削除"}
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting || deleting || !body.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {submitting ? "保存中..." : "感想を保存"}
        </button>
      </div>
    </div>
  );
}
