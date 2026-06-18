"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api";

type ReviewVisibility = "public" | "friends" | "private";

interface ExistingReview {
  id: string;
  body: string;
  rating: number | null;
  visibility: ReviewVisibility;
  isSpoiler: boolean;
  user: {
    id: string;
  };
}

interface CompletedBookImpressionEditorProps {
  workId: string;
  editionId: string | null;
}

const visibilityOptions: Array<{
  value: ReviewVisibility;
  label: string;
  description: string;
}> = [
  { value: "public", label: "公開", description: "だれでも見ることができます" },
  { value: "friends", label: "友だちのみ", description: "友だちだけが見ることができます" },
  { value: "private", label: "非公開", description: "自分だけが見ることができます" },
];

export default function CompletedBookImpressionEditor({
  workId,
  editionId,
}: CompletedBookImpressionEditorProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [review, setReview] = useState<ExistingReview | null>(null);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<ReviewVisibility>("public");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyReview = (nextReview: ExistingReview | null) => {
    setReview(nextReview);
    setBody(nextReview?.body ?? "");
    setRating(nextReview?.rating ?? null);
    setVisibility(nextReview?.visibility ?? "public");
    setIsSpoiler(nextReview?.isSpoiler ?? false);
  };

  const loadReview = async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(apiUrl(`/api/works/${workId}/reviews`));
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "感想の読み込みに失敗しました");
        return;
      }

      const data = await res.json();
      const ownReview =
        (data.reviews as ExistingReview[] | undefined)?.find(
          (item) => item.user.id === session.user.id
        ) ?? null;
      applyReview(ownReview);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditor = async () => {
    setIsOpen(true);
    await loadReview();
  };

  const handleSave = async () => {
    if (!body.trim()) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

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

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "感想の保存に失敗しました");
        return;
      }

      if (data?.review) {
        applyReview(data.review as ExistingReview);
      }
      setMessage("保存しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!review) return;
    if (!confirm("この読了メモ・感想を削除しますか？")) return;

    setIsDeleting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(apiUrl(`/api/works/${workId}/reviews`), {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "感想の削除に失敗しました");
        return;
      }

      applyReview(null);
      setMessage("削除しました");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-soft)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--color-ink-primary)]">
            読了メモ・感想
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
            読み終えたあとに残しておきたい感想を書けます。
          </p>
        </div>
        {!isOpen ? (
          <button
            type="button"
            onClick={openEditor}
            disabled={!session?.user?.id || isLoading}
            className="btn-primary-sm disabled:opacity-50"
          >
            感想を書く・編集する
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="btn-secondary-sm"
          >
            閉じる
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <p className="text-xs text-[var(--color-ink-faint)]">読み込み中...</p>
          ) : (
            <>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="読了後に残しておきたいメモや、この作品の感想を書いてください。"
                rows={4}
                className="w-full rounded border border-[var(--color-border-subtle)] bg-white p-3 text-sm leading-relaxed text-[var(--color-ink-primary)] outline-none transition focus:border-[var(--color-accent)]"
              />

              <fieldset>
                <legend className="mb-2 text-xs font-medium tracking-[0.05em] text-[var(--color-ink-muted)]">
                  公開範囲
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {visibilityOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`rounded border px-3 py-2 text-sm ${
                        visibility === option.value
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                          : "border-[var(--color-border-subtle)] bg-white"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium text-[var(--color-ink-primary)]">
                        <input
                          type="radio"
                          name={`completed-review-visibility-${workId}`}
                          value={option.value}
                          checked={visibility === option.value}
                          onChange={() => setVisibility(option.value)}
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

              <label className="flex items-start gap-2 rounded border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={isSpoiler}
                  onChange={(event) => setIsSpoiler(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-[var(--color-ink-primary)]">
                    ネタバレを含む
                  </span>
                  <span className="block text-xs text-[var(--color-ink-muted)]">
                    ネタバレありにすると、他の人には内容が隠された状態で表示されます。
                  </span>
                </span>
              </label>

              {message && <p className="text-xs text-[var(--color-status-success)]">{message}</p>}
              {error && <p className="text-xs text-[var(--color-accent)]">{error}</p>}

              <div className="flex flex-wrap justify-end gap-2">
                {review && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving || isDeleting}
                    className="btn-secondary-sm disabled:opacity-50"
                  >
                    {isDeleting ? "削除中..." : "削除"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isDeleting || !body.trim()}
                  className="btn-primary disabled:opacity-50"
                >
                  {isSaving ? "保存中..." : "保存する"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
