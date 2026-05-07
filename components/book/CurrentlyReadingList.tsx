"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import ProgressBar from "./ProgressBar";

const BASE_COUNT = 8;
const STEP = 20;

interface Reader {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  currentPage: number;
  progressPercent: number;
}

export default function CurrentlyReadingList({ bookId, refreshKey }: { bookId: string; refreshKey?: number }) {
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(BASE_COUNT);

  useEffect(() => {
    fetch(apiUrl(`/api/books/${bookId}/currently-reading`))
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setReaders(data.users || []))
      .catch(() => setReaders([]))
      .finally(() => setLoading(false));
  }, [bookId, refreshKey]);

  if (loading) return <p className="text-sm text-[var(--color-ink-faint)]">読み込み中...</p>;
  if (readers.length === 0) return <p className="text-sm text-[var(--color-ink-faint)]">今読んでいる人はいません</p>;

  const shown = readers.slice(0, visibleCount);
  const canExpand = visibleCount < readers.length;
  const canShrink = visibleCount > BASE_COUNT;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm font-medium text-[var(--color-ink-primary)]">
          今読んでいる人 ({readers.length}人)
        </h3>
        {canShrink && (
          <button
            onClick={() => setVisibleCount(BASE_COUNT)}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            上位{BASE_COUNT}人だけ見る
          </button>
        )}
      </div>

      {/* 縮めるボタン（上部） */}
      {canShrink && visibleCount > BASE_COUNT + STEP && (
        <button
          onClick={() => setVisibleCount(Math.max(visibleCount - STEP, BASE_COUNT))}
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] py-1 text-xs text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-base)]"
        >
          {STEP}人分縮める
        </button>
      )}

      {shown.map((reader) => (
        <Link key={reader.userId} href={`/users/${reader.userId}`} className="flex items-center gap-3 rounded-lg bg-[var(--color-bg-elevated)] p-3 hover:bg-[var(--color-bg-base)] transition">
          {reader.avatarUrl ? (
            <img
              src={reader.avatarUrl}
              alt={reader.displayName}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)] ${reader.avatarUrl ? "hidden" : ""}`}>
            {reader.displayName.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{reader.displayName}</p>
            <ProgressBar percent={reader.progressPercent} />
          </div>
        </Link>
      ))}

      {/* 下部ボタン群 */}
      {(canExpand || canShrink) && (
        <div className="flex gap-2">
          {canExpand && (
            <button
              onClick={() => setVisibleCount(Math.min(visibleCount + STEP, readers.length))}
              className="flex-1 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] py-1.5 text-xs text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-base)]"
            >
              もっと見る（+{Math.min(STEP, readers.length - visibleCount)}人）
            </button>
          )}
          {canShrink && (
            <button
              onClick={() => setVisibleCount(Math.max(visibleCount - STEP, BASE_COUNT))}
              className="flex-1 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] py-1.5 text-xs text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-base)]"
            >
              縮める（-{Math.min(STEP, visibleCount - BASE_COUNT)}人）
            </button>
          )}
        </div>
      )}
    </div>
  );
}
