"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import ProgressBar from "@/components/book/ProgressBar";
import CurrentlyReadingList from "@/components/book/CurrentlyReadingList";
import ReadingEvents from "@/components/book/ReadingEvents";
import CompletedBookImpressionEditor from "@/components/book/CompletedBookImpressionEditor";

interface Book {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  totalPages: number;
  coverImageUrl: string | null;
  description: string | null;
  migratedWorkId: string | null;
}

interface MyReading {
  id: string;
  book: {
    migratedWorkId: string | null;
  } | null;
  workId: string | null;
  editionId: string | null;
  status: string;
  currentPage: number;
  completedAt: string | null;
  edition: {
    workId: string;
  } | null;
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
  const [readersRefreshKey, setReadersRefreshKey] = useState(0);
  const [pageInputStr, setPageInputStr] = useState("");
  const [totalPagesInputStr, setTotalPagesInputStr] = useState("");
  const [showNoTotal, setShowNoTotal] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/books/${bookId}`));
      if (!res.ok) return;
      const data = await res.json();
      // Keep the book page visible so completed readers can edit impressions here.
      setBook({
        ...data.book,
        migratedWorkId: data.book?.migratedWorkId ?? data.migratedWorkId ?? null,
      });
      setTotalPagesInputStr(data.book.totalPages ? String(data.book.totalPages) : "");
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
        setPageInputStr(found.currentPage ? String(found.currentPage) : "");
      } else {
        setMyReading(null);
        setPageInputStr("");
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setReadersRefreshKey((k) => k + 1);
  };

  const pageInput = parseInt(pageInputStr, 10) || 0;
  const totalPagesInput = parseInt(totalPagesInputStr, 10) || 0;
  const pageExceedsTotal = totalPagesInput > 0 && pageInput > totalPagesInput;

  const handleUpdatePage = async () => {
    if (!myReading || updating || pageExceedsTotal) return;
    if (totalPagesInput === 0) { setShowNoTotal(true); return; }
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
      setReadersRefreshKey((k) => k + 1);
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
    setReadersRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-muted)]">本が見つかりませんでした</p>
      </div>
    );
  }

  const progress =
    book.totalPages > 0 && myReading
      ? Math.min(100, Math.floor((myReading.currentPage / book.totalPages) * 100))
      : 0;
  const isCompleted = myReading?.status === "COMPLETED";
  const impressionWorkId = isCompleted
    ? myReading.workId ??
      myReading.edition?.workId ??
      myReading.book?.migratedWorkId ??
      book.migratedWorkId
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="card-base p-6">
        <div className="flex flex-col gap-6 sm:flex-row">
          {book.coverImageUrl ? (
            <img
              src={book.coverImageUrl}
              alt={book.title}
              className="mx-auto h-48 w-32 shrink-0 rounded-sm object-cover shadow-[var(--shadow-cover)] sm:mx-0"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                el.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`mx-auto flex h-48 w-32 shrink-0 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-sm text-[var(--color-ink-faint)] sm:mx-0 ${book.coverImageUrl ? "hidden" : ""}`}>
            No Image
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)] md:text-2xl">{book.title}</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{book.author}</p>
            {book.totalPages > 0 && (
              <p className="mt-1 text-xs font-mono text-[var(--color-ink-faint)]">{book.totalPages}ページ</p>
            )}
            {book.isbn && (
              <p className="mt-1 text-xs font-mono text-[var(--color-ink-faint)]">ISBN: {book.isbn}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-3">
              <span className={`text-sm ${readingCount > 0 ? "text-[var(--color-accent)]" : "text-[var(--color-ink-faint)]"}`}>
                📖 {readingCount}人が読書中
              </span>
              <span className={`text-sm ${completedCount > 0 ? "text-[var(--color-status-success)]" : "text-[var(--color-ink-faint)]"}`}>
                ✅ {completedCount}人が読了
              </span>
              <a
                href="#events"
                className={`text-sm ${eventCount > 0 ? "text-[var(--color-ink-muted)] hover:underline" : "text-[var(--color-ink-faint)]"}`}
              >
                📅 {eventCount}件の読書会
              </a>
            </div>

            {/* 自分のステータス */}
            <div className="mt-4">
              {!myReading ? (
                <button
                  onClick={handleStartReading}
                  className="btn-primary"
                >
                  読み始める
                </button>
              ) : myReading.status === "READING" ? (
                <div className="space-y-3">
                  <span className="badge-reading">
                    読書中
                  </span>

                  {/* プログレスバー: totalPages がある時のみ */}
                  {book.totalPages > 0 && <ProgressBar percent={progress} />}

                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {myReading.currentPage}
                    {book.totalPages > 0
                      ? ` / ${book.totalPages} ページ（`
                      : " ページ読了"}
                    {book.totalPages > 0 && <span className="font-mono font-medium text-[var(--color-accent)]">{progress}%</span>}
                    {book.totalPages > 0 && "）"}
                  </p>

                  {/* ページ数入力フォーム */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pageInputStr}
                        onChange={(e) => { setPageInputStr(e.target.value.replace(/[^0-9]/g, "")); setShowNoTotal(false); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdatePage();
                        }}
                        className="w-20 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-2 py-1 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                        placeholder="現在"
                      />
                      <span className="text-[var(--color-ink-faint)]">/</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={totalPagesInputStr}
                        onChange={(e) => { setTotalPagesInputStr(e.target.value.replace(/[^0-9]/g, "")); setShowNoTotal(false); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdatePage();
                        }}
                        className="w-20 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-2 py-1 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                        placeholder="総ページ"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={updating || pageExceedsTotal}
                      onClick={handleUpdatePage}
                      className="btn-dark disabled:opacity-50"
                    >
                      {updating ? "更新中..." : "更新"}
                    </button>
                  </div>

                  {/* 検証メッセージ */}
                  {pageExceedsTotal && (
                    <p className="text-xs text-red-600">総ページ数を超えた値が入力されています</p>
                  )}
                  {showNoTotal && (
                    <p className="text-xs text-amber-600">総ページ数が入力されていません</p>
                  )}

                  <button
                    onClick={handleMarkCompleted}
                    className="border border-[rgb(184_71_60_/_0.4)] text-[var(--color-accent)] bg-transparent px-3.5 py-1.5 rounded text-xs tracking-[0.08em] hover:bg-[var(--color-accent-soft)] transition-colors"
                  >
                    読了にする
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="badge-completed">
                    読了
                  </span>
                  {myReading.completedAt && (
                    <p className="text-xs font-mono text-[var(--color-ink-faint)]">
                      読了日: {new Date(myReading.completedAt).toLocaleDateString("ja-JP")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <Link
                      href={`/books/${book.id}/chat`}
                      className="btn-primary-sm whitespace-nowrap"
                    >
                      読了チャットに参加
                    </Link>
                    <button
                      onClick={handleRevertToReading}
                      className="whitespace-nowrap text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-accent)]"
                    >
                      読みかけに戻す
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {isCompleted && myReading && (
          <section className="mt-6 w-full rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-soft)] p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-sm font-medium text-[var(--color-ink-primary)]">
                読了メモ・感想
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                読了した本について、自分の感想を残せます。
              </p>
            </div>
            <div className="space-y-3">
              <CompletedBookImpressionEditor
                bookId={book.id}
                workId={impressionWorkId}
                editionId={myReading.editionId}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Link
                  href={impressionWorkId ? `/works/${impressionWorkId}` : `/books/${book.id}/impressions`}
                  className="whitespace-nowrap text-xs text-[var(--color-accent)] hover:underline"
                >
                  みんなの感想を見る
                </Link>
                <Link
                  href="/mypage/completed"
                  className="whitespace-nowrap text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-accent)]"
                >
                  読了本一覧に戻る
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* 今読んでいる人 */}
      <div className="mt-5 card-base p-5">
        <CurrentlyReadingList bookId={bookId} refreshKey={readersRefreshKey} />
      </div>

      {/* 読書会の予定 */}
      <div className="mt-5" id="events">
        <ReadingEvents bookId={bookId} bookTitle={book?.title} />
      </div>

      {/* チャットへのリンク */}
      <div className="mt-5 card-base p-4 text-center">
        <Link
          href={`/books/${book.id}/chat`}
          className="font-serif text-sm text-[var(--color-accent)] hover:underline"
        >
          読了チャットを見る →
        </Link>
      </div>
    </div>
  );
}
