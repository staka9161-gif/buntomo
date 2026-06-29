"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  bookId: string;
  workId?: string | null;
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

const visibilityLabels: Record<ReviewVisibility, string> = {
  public: "公開",
  friends: "友だちのみ",
  private: "非公開",
};

function createExcerpt(value: string, maxLength = 110) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function normalizeVisibility(value: unknown): ReviewVisibility {
  return value === "friends" || value === "private" || value === "public" ? value : "public";
}

export default function CompletedBookImpressionEditor({
  bookId,
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
  const [defaultVisibility, setDefaultVisibility] = useState<ReviewVisibility>("public");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyReview = useCallback((nextReview: ExistingReview | null, fallbackVisibility = defaultVisibility) => {
    setReview(nextReview);
    setBody(nextReview?.body ?? "");
    setRating(nextReview?.rating ?? null);
    setVisibility(nextReview?.visibility ?? fallbackVisibility);
    setIsSpoiler(nextReview?.isSpoiler ?? false);
  }, [defaultVisibility]);

  const loadReview = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      if (!session?.user?.id) return;

      if (showLoading) {
        setIsLoading(true);
        setError(null);
        setMessage(null);
      }

      try {
        const res = await fetch(apiUrl(`/api/books/${bookId}/impression`));
        if (!res.ok) {
          if (showLoading) {
            const data = await res.json().catch(() => null);
            setError(data?.error || "感想の読み込みに失敗しました");
          }
          return;
        }

        const data = await res.json();
        const nextDefaultVisibility = normalizeVisibility(data.defaultVisibility);
        setDefaultVisibility(nextDefaultVisibility);
        applyReview((data.review as ExistingReview | null | undefined) ?? null, nextDefaultVisibility);
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [applyReview, bookId, session?.user?.id]
  );

  useEffect(() => {
    let ignore = false;

    const loadInitialReview = async () => {
      if (!session?.user?.id) return;

      try {
        const res = await fetch(apiUrl(`/api/books/${bookId}/impression`));
        if (!res.ok) return;

        const data = await res.json();
        if (!ignore) {
          const nextDefaultVisibility = normalizeVisibility(data.defaultVisibility);
          setDefaultVisibility(nextDefaultVisibility);
          applyReview((data.review as ExistingReview | null | undefined) ?? null, nextDefaultVisibility);
        }
      } catch {
        // Opening the editor will surface loading errors if needed.
      }
    };

    void loadInitialReview();
    return () => {
      ignore = true;
    };
  }, [applyReview, bookId, session?.user?.id]);

  const reviewExcerpt = useMemo(() => {
    return review ? createExcerpt(review.body) : null;
  }, [review]);

  const openEditor = async () => {
    setIsOpen(true);
    await loadReview();
  };

  const handleCancel = () => {
    applyReview(review);
    setError(null);
    setMessage(null);
    setIsOpen(false);
  };

  const handleSave = async () => {
    if (!body.trim()) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(apiUrl(`/api/books/${bookId}/impression`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editionId,
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
      setIsOpen(false);
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
      const res = await fetch(apiUrl(`/api/books/${bookId}/impression`), {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "感想の削除に失敗しました");
        return;
      }

      applyReview(null);
      setMessage("削除しました");
      setIsOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!session?.user?.id) {
    return (
      <div className="border-t border-[var(--color-border-subtle)] pt-3">
        <p className="text-sm text-[var(--color-ink-muted)]">
          感想を書くにはログインが必要です。
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--color-border-subtle)] pt-3">
      {!isOpen ? (
        <div className="space-y-3">
          {review && reviewExcerpt ? (
            <div>
              <p className="text-xs font-semibold tracking-[0.05em] text-[var(--color-ink-muted)]">
                あなたの感想
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-primary)]">
                {reviewExcerpt}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-[rgb(31_42_68_/_0.05)] px-2 py-0.5 text-[10px] text-[var(--color-ink-muted)]">
                  {visibilityLabels[review.visibility] ?? "公開"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    review.isSpoiler
                      ? "bg-[rgb(184_71_60_/_0.08)] text-[var(--color-accent)]"
                      : "bg-[rgb(31_42_68_/_0.05)] text-[var(--color-ink-muted)]"
                  }`}
                >
                  {review.isSpoiler ? "ネタバレあり" : "ネタバレなし"}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-[var(--color-ink-primary)]">
                まだ感想はありません。
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                読了した本について、あとで見返せる感想を残せます。
              </p>
            </div>
          )}

          {message && <p className="text-xs text-[var(--color-status-success)]">{message}</p>}
          <button
            type="button"
            onClick={openEditor}
            disabled={isLoading}
            className="btn-secondary-sm disabled:opacity-50"
          >
            {review ? "編集する" : "感想を書く"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink-primary)]">
              読了メモ・感想を書く
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              自分用のメモとして残しつつ、公開範囲を選べます。
            </p>
          </div>

          {isLoading ? (
            <p className="text-xs text-[var(--color-ink-faint)]">読み込み中...</p>
          ) : (
            <>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="読了後に残しておきたいことや、この本の感想を書いてください。"
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
                          name={`completed-review-visibility-${workId ?? bookId}`}
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

              {error && <p className="text-xs text-[var(--color-accent)]">{error}</p>}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {review && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSaving || isDeleting}
                      className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-accent)] disabled:opacity-50"
                    >
                      {isDeleting ? "削除中..." : "削除する"}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving || isDeleting}
                    className="btn-secondary-sm disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isDeleting || !body.trim()}
                    className="btn-primary-sm disabled:opacity-50"
                  >
                    {isSaving ? "保存中..." : "保存する"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
