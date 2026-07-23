"use client";

import { useRef, useState } from "react";
import { apiUrl } from "@/lib/api";

export const CONFIRM_MESSAGE =
  "この本を読みかけ一覧から解除します。本の情報や読了メモ・感想は削除されません。";
const MISSING_ID_MESSAGE = "読書状態を再取得してから、もう一度お試しください。";
const DEFAULT_ERROR_MESSAGE = "読みかけを解除できませんでした。";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type RemoveReadingStatusOptions = {
  readingStatusId?: string | null;
  request?: FetchLike;
  onRemoved?: (readingStatusId: string) => Promise<void> | void;
};

type Props = {
  readingStatusId?: string | null;
  bookTitle?: string;
  onRemoved?: (readingStatusId: string) => Promise<void> | void;
  className?: string;
};

type ConfirmationProps = {
  isRemoving: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function createInFlightGuard() {
  let active = false;

  return {
    tryStart() {
      if (active) return false;
      active = true;
      return true;
    },
    finish() {
      active = false;
    },
  };
}

export async function removeReadingStatus({
  readingStatusId,
  request = fetch,
  onRemoved,
}: RemoveReadingStatusOptions): Promise<"removed"> {
  const normalizedId = readingStatusId?.trim();
  if (!normalizedId) {
    throw new Error(MISSING_ID_MESSAGE);
  }

  const response = await request(
    apiUrl(`/api/me/readings?readingStatusId=${encodeURIComponent(normalizedId)}`),
    { method: "DELETE" }
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || DEFAULT_ERROR_MESSAGE);
  }

  await onRemoved?.(normalizedId);
  return "removed";
}

export function ReadingStatusRemovalConfirmation({
  isRemoving,
  error,
  onConfirm,
  onCancel,
}: ConfirmationProps) {
  return (
    <div
      role="alertdialog"
      aria-label="読みかけ解除の確認"
      className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-soft)] p-3"
    >
      <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
        {CONFIRM_MESSAGE}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isRemoving}
          className="btn-secondary-sm disabled:opacity-50"
        >
          {isRemoving ? "解除中..." : "解除する"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isRemoving}
          className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-accent)] disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ReadingStatusRemoveButton({
  readingStatusId,
  bookTitle,
  onRemoved,
  className = "btn-secondary-sm disabled:opacity-50",
}: Props) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardRef = useRef(createInFlightGuard());

  const handleOpenConfirmation = () => {
    if (!readingStatusId?.trim()) {
      setError(MISSING_ID_MESSAGE);
      return;
    }

    setError(null);
    setIsConfirming(true);
  };

  const handleConfirmRemove = async () => {
    const guard = guardRef.current;
    if (!guard.tryStart()) return;

    setError(null);
    setIsRemoving(true);
    try {
      await removeReadingStatus({
        readingStatusId,
        onRemoved,
      });
      setIsConfirming(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : DEFAULT_ERROR_MESSAGE);
    } finally {
      guard.finish();
      setIsRemoving(false);
    }
  };

  if (isConfirming) {
    return (
      <ReadingStatusRemovalConfirmation
        isRemoving={isRemoving}
        error={error}
        onConfirm={handleConfirmRemove}
        onCancel={() => {
          setError(null);
          setIsConfirming(false);
        }}
      />
    );
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={handleOpenConfirmation}
        disabled={isRemoving}
        className={className}
        aria-label={bookTitle ? `${bookTitle}を読みかけから解除` : undefined}
      >
        {isRemoving ? "解除中..." : "読みかけを解除"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
