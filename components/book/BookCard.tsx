"use client";

import { useState, useEffect } from "react";
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
  onDelete?: (readingId: string) => void;
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
  onDelete,
}: BookCardProps) {
  const [localPage, setLocalPage] = useState(currentPage ?? 0);
  useEffect(() => { setLocalPage(currentPage ?? 0); }, [currentPage]);
  const progress = totalPages > 0 && currentPage !== undefined
    ? Math.floor((currentPage / totalPages) * 100)
    : 0;

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
              <ProgressBar percent={progress} />
              <p className="mt-1 text-[11px] font-mono text-[var(--color-ink-faint)]">
                {currentPage} / {totalPages} ページ
              </p>

              {readingId && onUpdatePage && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={totalPages || 99999}
                    value={localPage}
                    onChange={(e) => setLocalPage(Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onUpdatePage(readingId, localPage);
                    }}
                    className="w-20 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => onUpdatePage(readingId, localPage)}
                    className="btn-dark"
                  >
                    更新
                  </button>
                </div>
              )}

              <div className="mt-2 flex gap-2">
                {readingId && onStatusChange && (
                  <button
                    onClick={() => onStatusChange(readingId, "COMPLETED")}
                    className="border border-[rgb(184_71_60_/_0.4)] text-[var(--color-accent)] bg-transparent px-3.5 py-1.5 rounded text-xs tracking-[0.08em] hover:bg-[var(--color-accent-soft)] transition-colors"
                  >
                    読了にする
                  </button>
                )}
                {readingId && onDelete && (
                  <button
                    onClick={() => {
                      if (confirm("この本を本棚から削除しますか？")) onDelete(readingId);
                    }}
                    className="btn-secondary-sm"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          )}

          {status === "COMPLETED" && completedAt && (
            <div className="mt-2">
              <span className="badge-completed">
                読了
              </span>
              <span className="ml-2 text-[11px] font-mono text-[var(--color-ink-faint)]">
                {new Date(completedAt).toLocaleDateString("ja-JP")}
              </span>
              <div className="mt-1 flex items-center gap-3">
                <Link
                  href={`/books/${id}/chat`}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  読了チャットに参加
                </Link>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
