"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";

interface ReviewFormProps {
  workId: string;
  editionId: string | null;
  isLoggedIn: boolean;
  onSubmitted: () => void;
}

export default function ReviewForm({
  workId,
  editionId,
  isLoggedIn,
  onSubmitted,
}: ReviewFormProps) {
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
        }),
      });
      if (res.ok) {
        setBody("");
        setRating(null);
        onSubmitted();
      } else {
        const data = await res.json();
        setError(data.error || "送信に失敗しました");
      }
    } finally {
      setSubmitting(false);
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

      {error && <p className="mt-1 text-xs text-[var(--color-accent)]">{error}</p>}

      <div className="mt-2 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || !body.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {submitting ? "保存中..." : "感想を保存"}
        </button>
      </div>
    </div>
  );
}
