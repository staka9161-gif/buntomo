"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import ProgressBar from "@/components/book/ProgressBar";
import CurrentlyReadingList from "@/components/book/CurrentlyReadingList";
import ReadingEvents from "@/components/book/ReadingEvents";

interface Book {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  totalPages: number;
  coverImageUrl: string | null;
  description: string | null;
}

interface MyReading {
  id: string;
  status: string;
  currentPage: number;
  completedAt: string | null;
}

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [myReading, setMyReading] = useState<MyReading | null>(null);
  const [readingCount, setReadingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageInput, setPageInput] = useState(0);
  const [totalPagesInput, setTotalPagesInput] = useState(0);
  const [updating, setUpdating] = useState(false);

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/books/${bookId}`));
      if (!res.ok) return;
      const data = await res.json();
      setBook(data.book);
      setTotalPagesInput(data.book.totalPages || 0);
      setReadingCount(data.readingCount ?? 0);
      setCompletedCount(data.completedCount ?? 0);
      setEventCount(data.eventCount ?? 0);
    } catch {
      // network error
    }
  }, [bookId]);

  const fetchMyReading = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/me/readings?status="));
      if (!res.ok) return;
      const data = await res.json();
      const found = (data.readings || []).find(
        (r: { bookId: string }) => r.bookId === bookId
      );
      if (found) {
        setMyReading(found);
        setPageInput(found.currentPage);
      } else {
        setMyReading(null);
        setPageInput(0);
      }
    } catch {
      // network error
    }
  }, [bookId]);

  useEffect(() => {
    const init = async () => {
      await fetchBook();
      setLoading(false);
    };
    init();
  }, [fetchBook]);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchMyReading();
    }
  }, [sessionStatus, fetchMyReading]);

  const refreshAll = async () => {
    await Promise.all([fetchBook(), fetchMyReading()]);
  };

  const handleStartReading = async () => {
    if (!session) {
      router.push("/login");
      return;
    }
    await fetch(apiUrl("/api/me/readings"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, status: "READING" }),
    });
    await refreshAll();
  };

  const handleMarkCompleted = async () => {
    if (!myReading) return;
    await fetch(apiUrl(`/api/me/readings/${myReading.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    await refreshAll();
  };

  const handleUpdatePage = async () => {
    if (!myReading || updating) return;
    setUpdating(true);
    try {
      // 総ページ数が変更されていたら先に更新
      if (totalPagesInput > 0 && book && totalPagesInput !== book.totalPages) {
        await fetch(apiUrl(`/api/books/${book.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalPages: totalPagesInput }),
        });
      }
      // 現在ページ数を更新
      await fetch(apiUrl(`/api/me/readings/${myReading.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPage: pageInput }),
      });
      await refreshAll();
    } finally {
      setUpdating(false);
    }
  };

  const handleRevertToReading = async () => {
    if (!myReading) return;
    await fetch(apiUrl(`/api/me/readings/${myReading.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READING" }),
    });
    await refreshAll();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">本が見つかりませんでした</p>
      </div>
    );
  }

  const progress =
    book.totalPages > 0 && myReading
      ? Math.min(100, Math.floor((myReading.currentPage / book.totalPages) * 100))
      : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex gap-6">
          {book.coverImageUrl ? (
            <img
              src={book.coverImageUrl}
              alt={book.title}
              className="h-48 w-32 shrink-0 rounded-lg object-cover shadow"
            />
          ) : (
            <div className="flex h-48 w-32 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
              No Image
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
            <p className="mt-1 text-gray-500">{book.author}</p>
            {book.totalPages > 0 && (
              <p className="mt-1 text-sm text-gray-400">{book.totalPages}ページ</p>
            )}
            {book.isbn && (
              <p className="mt-1 text-xs text-gray-400">ISBN: {book.isbn}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-3">
              <span className={`text-sm ${readingCount > 0 ? "text-amber-600" : "text-gray-300"}`}>
                📖 {readingCount}人が読書中
              </span>
              <span className={`text-sm ${completedCount > 0 ? "text-green-600" : "text-gray-300"}`}>
                ✅ {completedCount}人が読了
              </span>
              <a
                href="#events"
                className={`text-sm ${eventCount > 0 ? "text-blue-600 hover:underline" : "text-gray-300"}`}
              >
                📅 {eventCount}件の読書会
              </a>
            </div>

            {/* 自分のステータス */}
            <div className="mt-4">
              {!myReading ? (
                <button
                  onClick={handleStartReading}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  読み始める
                </button>
              ) : myReading.status === "READING" ? (
                <div className="space-y-3">
                  <div className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    読書中
                  </div>

                  {/* プログレスバー: totalPagesがある時のみ表示 */}
                  {book.totalPages > 0 && <ProgressBar percent={progress} />}

                  {/* ページ数表示 */}
                  <p className="text-sm text-gray-600">
                    {myReading.currentPage}
                    {book.totalPages > 0
                      ? ` / ${book.totalPages} ページ（${progress}%）`
                      : " ページ読了"}
                  </p>

                  {/* ページ数入力フォーム */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={totalPagesInput || 99999}
                        value={pageInput}
                        onChange={(e) => setPageInput(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdatePage();
                        }}
                        className="w-20 rounded border px-2 py-1.5 text-sm"
                        placeholder="現在"
                      />
                      <span className="text-gray-400">/</span>
                      <input
                        type="number"
                        min={1}
                        max={99999}
                        value={totalPagesInput || ""}
                        onChange={(e) => setTotalPagesInput(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdatePage();
                        }}
                        className="w-20 rounded border px-2 py-1.5 text-sm"
                        placeholder="総ページ"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={handleUpdatePage}
                      className="rounded bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {updating ? "更新中..." : "更新"}
                    </button>
                  </div>

                  {/* 総ページ数が未設定の場合のヒント */}
                  {book.totalPages === 0 && (
                    <p className="text-xs text-gray-400">
                      総ページ数を入力すると進捗バーが表示されます
                    </p>
                  )}

                  <button
                    onClick={handleMarkCompleted}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    読了にする
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    読了
                  </div>
                  {myReading.completedAt && (
                    <p className="text-xs text-gray-400">
                      読了日: {new Date(myReading.completedAt).toLocaleDateString("ja-JP")}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/books/${book.id}/chat`}
                      className="inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                    >
                      読了チャットに参加
                    </Link>
                    <button
                      onClick={handleRevertToReading}
                      className="text-xs text-gray-400 hover:text-amber-600"
                    >
                      読みかけに戻す
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {book.description && (
          <div className="mt-6 border-t pt-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">あらすじ</h2>
            <p className="text-sm leading-relaxed text-gray-600">{book.description}</p>
          </div>
        )}
      </div>

      {/* 今読んでいる人 */}
      <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <CurrentlyReadingList bookId={bookId} />
      </div>

      {/* 読書会の予定 */}
      <div className="mt-6" id="events">
        <ReadingEvents bookId={bookId} bookTitle={book?.title} />
      </div>

      {/* チャットへのリンク */}
      <div className="mt-6 rounded-xl border bg-white p-6 text-center shadow-sm">
        <Link
          href={`/books/${book.id}/chat`}
          className="text-amber-600 hover:underline"
        >
          読了チャットを見る →
        </Link>
      </div>
    </div>
  );
}
