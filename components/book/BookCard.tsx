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
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex gap-4">
        <Link href={`/books/${id}`} className="shrink-0">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={title}
              className="h-32 w-22 rounded object-cover"
            />
          ) : (
            <div className="flex h-32 w-22 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
              No Image
            </div>
          )}
        </Link>

        <div className="flex flex-1 flex-col">
          <Link href={`/books/${id}`} className="font-semibold text-gray-900 hover:text-amber-700">
            {title}
          </Link>
          <p className="text-sm text-gray-500">{author}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className={`text-xs ${readingCount > 0 ? "text-amber-600" : "text-gray-300"}`}>
              📖 {readingCount}人が読書中
            </span>
            <span className={`text-xs ${completedCount > 0 ? "text-green-600" : "text-gray-300"}`}>
              ✅ {completedCount}人が読了
            </span>
            <Link
              href={`/books/${id}#events`}
              className={`text-xs ${eventCount > 0 ? "text-blue-600 hover:underline" : "text-gray-300"}`}
            >
              📅 {eventCount}件の読書会
            </Link>
          </div>

          {status === "READING" && (
            <div className="mt-2">
              <ProgressBar percent={progress} />
              <p className="mt-1 text-xs text-gray-400">
                {currentPage} / {totalPages} ページ
              </p>

              {readingId && onUpdatePage && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={totalPages}
                    value={localPage}
                    onChange={(e) => setLocalPage(Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onUpdatePage(readingId, localPage);
                    }}
                    className="w-20 rounded border px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => onUpdatePage(readingId, localPage)}
                    className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 hover:bg-amber-200"
                  >
                    更新
                  </button>
                </div>
              )}

              <div className="mt-2 flex gap-2">
                {readingId && onStatusChange && (
                  <button
                    onClick={() => onStatusChange(readingId, "COMPLETED")}
                    className="rounded bg-green-100 px-3 py-1 text-xs text-green-700 hover:bg-green-200"
                  >
                    読了にする
                  </button>
                )}
                {readingId && onDelete && (
                  <button
                    onClick={() => {
                      if (confirm("この本を本棚から削除しますか？")) onDelete(readingId);
                    }}
                    className="rounded bg-red-50 px-3 py-1 text-xs text-red-500 hover:bg-red-100"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          )}

          {status === "COMPLETED" && completedAt && (
            <div className="mt-2">
              <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                読了
              </span>
              <span className="ml-2 text-xs text-gray-400">
                {new Date(completedAt).toLocaleDateString("ja-JP")}
              </span>
              <div className="mt-1 flex items-center gap-3">
                <Link
                  href={`/books/${id}/chat`}
                  className="text-xs text-amber-600 hover:underline"
                >
                  読了チャットに参加
                </Link>
                {readingId && onStatusChange && (
                  <button
                    onClick={() => onStatusChange(readingId, "READING")}
                    className="text-xs text-gray-400 hover:text-amber-600"
                  >
                    読みかけに戻す
                  </button>
                )}
                {readingId && onDelete && (
                  <button
                    onClick={() => {
                      if (confirm("この本を本棚から削除しますか？")) onDelete(readingId);
                    }}
                    className="text-xs text-red-400 hover:text-red-600"
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
