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
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">レビューを書く</h3>

      {/* 星評価 */}
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(rating === n ? null : n)}
            className={`text-xl ${n <= (rating ?? 0) ? "text-amber-400" : "text-gray-300"} hover:text-amber-400`}
          >
            ★
          </button>
        ))}
        {rating && (
          <button onClick={() => setRating(null)} className="ml-1 text-xs text-gray-400 hover:text-gray-600">
            クリア
          </button>
        )}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="この作品の感想を書いてください..."
        className="w-full rounded border px-3 py-2 text-sm"
        rows={3}
      />

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      <div className="mt-2 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || !body.trim()}
          className="rounded bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {submitting ? "送信中..." : "投稿する"}
        </button>
      </div>
    </div>
  );
}
