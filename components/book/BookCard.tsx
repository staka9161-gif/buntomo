"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import ProgressBar from "./ProgressBar";

interface BookCardProps {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
  currentPage?: number;
  totalPages: number;
  status?: string;
  completedAt?: string | null;
  readingId?: string;
  readingCount?: number;
  completedCount?: number;
  eventCount?: number;
  onUpdatePage?: (readingId: string, page: number) => void;
  onStatusChange?: (readingId: string, status: string) => void;
  onCompletedAtChange?: (readingId: string, completedAt: string) => Promise<boolean> | boolean;
  onDelete?: (readingId: string) => void;
  onRemoveReading?: (bookId: string) => Promise<void> | void;
  showCompletedDate?: boolean;
  impressionHref?: string;
  impressionEditor?: ReactNode;
}

function toDateInputValue(value?: string | Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatCompletedDate(value?: string | Date | null): string {
  const inputValue = toDateInputValue(value);
  if (!inputValue) return "読了日未設定";
  return inputValue;
}

export default function BookCard({
  id,
  title,
  author,
  coverImageUrl,
  currentPage,
  totalPages,
  status,
  completedAt,
  readingId,
  readingCount = 0,
  completedCount = 0,
  eventCount = 0,
  onUpdatePage,
  onStatusChange,
  onCompletedAtChange,
  onDelete,
  onRemoveReading,
  showCompletedDate = false,
  impressionHref,
  impressionEditor,
}: BookCardProps) {
  const [localPageStr, setLocalPageStr] = useState(currentPage ? String(currentPage) : "");
  const [showNoTotal, setShowNoTotal] = useState(false);
  const [isEditingCompletedAt, setIsEditingCompletedAt] = useState(false);
  const [completedAtInput, setCompletedAtInput] = useState(toDateInputValue(completedAt));
  const [isSavingCompletedAt, setIsSavingCompletedAt] = useState(false);
  const [isRemovingReading, setIsRemovingReading] = useState(false);
  const [removeReadingError, setRemoveReadingError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalPageStr(currentPage ? String(currentPage) : ""); }, [currentPage]);
  const localPageNum = parseInt(localPageStr, 10) || 0;
  const progress = totalPages > 0 && currentPage !== undefined
    ? Math.floor((currentPage / totalPages) * 100)
    : 0;
  const pageExceedsTotal = totalPages > 0 && localPageNum > totalPages;
  const canEditCompletedAt = !!readingId && !!onCompletedAtChange && status === "COMPLETED";

  const handleSaveCompletedAt = async () => {
    if (!readingId || !onCompletedAtChange || !completedAtInput) return;
    setIsSavingCompletedAt(true);
    try {
      const saved = await onCompletedAtChange(readingId, completedAtInput);
      if (saved) {
        setIsEditingCompletedAt(false);
      }
    } finally {
      setIsSavingCompletedAt(false);
    }
  };

  const handleRemoveReading = async () => {
    if (!onRemoveReading || isRemovingReading) return;
    if (!confirm("この本を読みかけ一覧から削除します。本の情報や感想は削除されません。")) return;

    setIsRemovingReading(true);
    setRemoveReadingError(null);
    try {
      await onRemoveReading(id);
    } catch (error) {
      setRemoveReadingError(
        error instanceof Error ? error.message : "読みかけの解除に失敗しました"
      );
    } finally {
      setIsRemovingReading(false);
    }
  };

  return (
    <div className="card-base p-5 transition hover:shadow-md">
      <div className="flex gap-4">
        <Link href={`/books/${id}`} className="shrink-0">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={title}
              className="h-32 w-22 rounded-sm shadow-[var(--shadow-cover)] object-cover"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                el.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`flex h-32 w-22 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-xs text-[var(--color-ink-faint)] ${coverImageUrl ? "hidden" : ""}`}>
            No Image
          </div>
        </Link>

        <div className="flex flex-1 flex-col">
          <Link href={`/books/${id}`} className="font-serif text-base font-medium tracking-[0.05em] text-[var(--color-ink-primary)] hover:text-[var(--color-accent)] md:text-lg">
            {title}
          </Link>
          <p className="text-xs text-[var(--color-ink-muted)]">{author}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className={`text-xs ${readingCount > 0 ? "text-[var(--color-accent)]" : "text-[var(--color-ink-faint)]"}`}>
              📖 {readingCount}人が読書中
            </span>
            <span className={`text-xs ${completedCount > 0 ? "text-[var(--color-status-success)]" : "text-[var(--color-ink-faint)]"}`}>
              ✅ {completedCount}人が読了
            </span>
            <Link
              href={`/books/${id}#events`}
              className={`text-xs ${eventCount > 0 ? "text-[var(--color-ink-muted)] hover:underline" : "text-[var(--color-ink-faint)]"}`}
            >
              📅 {eventCount}件の読書会
            </Link>
          </div>

          {status === "READING" && (
            <div className="mt-2">
              {totalPages > 0 && (
                <>
                  <ProgressBar percent={progress} />
                  <p className="mt-1 text-[11px] font-mono text-[var(--color-ink-faint)]">
                    {currentPage} / {totalPages} ページ
                  </p>
                </>
              )}

              {readingId && onUpdatePage && (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={localPageStr}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "");
                        setLocalPageStr(v);
                        setShowNoTotal(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (totalPages === 0) { setShowNoTotal(true); return; }
                          if (!pageExceedsTotal) onUpdatePage(readingId, localPageNum);
                        }
                      }}
                      placeholder="0"
                      className="w-20 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => {
                        if (totalPages === 0) { setShowNoTotal(true); return; }
                        if (!pageExceedsTotal) onUpdatePage(readingId, localPageNum);
                      }}
                      disabled={pageExceedsTotal}
                      className="btn-dark disabled:opacity-50"
                    >
                      更新
                    </button>
                  </div>
                  {pageExceedsTotal && (
                    <p className="mt-1 text-xs text-red-600">総ページ数を超えた値が入力されています</p>
                  )}
                  {showNoTotal && (
                    <p className="mt-1 text-xs text-amber-600">総ページ数が入力されていません</p>
                  )}
                </>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                {readingId && onStatusChange && (
                  <button
                    onClick={() => onStatusChange(readingId, "COMPLETED")}
                    className="border border-[rgb(184_71_60_/_0.4)] text-[var(--color-accent)] bg-transparent px-3.5 py-1.5 rounded text-xs tracking-[0.08em] hover:bg-[var(--color-accent-soft)] transition-colors"
                  >
                    読了にする
                  </button>
                )}
                {readingId && onRemoveReading && (
                  <button
                    onClick={handleRemoveReading}
                    disabled={isRemovingReading}
                    className="btn-secondary-sm disabled:opacity-50"
                  >
                    {isRemovingReading ? "解除中..." : "読みかけを解除"}
                  </button>
                )}
              </div>
              {removeReadingError && (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  {removeReadingError}
                </p>
              )}
            </div>
          )}

          {status === "COMPLETED" && (completedAt || showCompletedDate) && (
            <div className="mt-2">
              <span className="badge-completed">
                読了
              </span>
              <span className="ml-2 text-[11px] font-mono text-[var(--color-ink-faint)]">
                {formatCompletedDate(completedAt)}
              </span>
              {canEditCompletedAt && (
                <div className="mt-2">
                  {isEditingCompletedAt ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={completedAtInput}
                        onChange={(e) => setCompletedAtInput(e.target.value)}
                        className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm"
                      />
                      <button
                        onClick={handleSaveCompletedAt}
                        disabled={!completedAtInput || isSavingCompletedAt}
                        className="btn-dark disabled:opacity-50"
                      >
                        {isSavingCompletedAt ? "保存中..." : "保存"}
                      </button>
                      <button
                        onClick={() => {
                          setCompletedAtInput(toDateInputValue(completedAt));
                          setIsEditingCompletedAt(false);
                        }}
                        disabled={isSavingCompletedAt}
                        className="btn-secondary-sm disabled:opacity-50"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setCompletedAtInput(toDateInputValue(completedAt));
                        setIsEditingCompletedAt(true);
                      }}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      読了日を変更
                    </button>
                  )}
                </div>
              )}
              <div className="mt-1 flex items-center gap-3">
                <Link
                  href={`/books/${id}`}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  本ページを見る
                </Link>
                <Link
                  href={`/books/${id}/chat`}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  読了チャットに参加
                </Link>
                {impressionHref && (
                  <Link
                    href={impressionHref}
                    className="text-xs text-[var(--color-accent)] hover:underline"
                  >
                    みんなの感想を見る
                  </Link>
                )}
                {readingId && onStatusChange && (
                  <button
                    onClick={() => onStatusChange(readingId, "READING")}
                    className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-accent)]"
                  >
                    読みかけに戻す
                  </button>
                )}
                {readingId && onDelete && (
                  <button
                    onClick={() => {
                      if (confirm("この本を本棚から削除しますか？")) onDelete(readingId);
                    }}
                    className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-accent)]"
                  >
                    削除
                  </button>
                )}
              </div>
              {impressionEditor && <div className="mt-3">{impressionEditor}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
