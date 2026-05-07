"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface SearchResult {
  isbn: string | null;
  title: string;
  author: string;
  publisher: string | null;
  publishedDate: string | null;
  totalPages: number;
  coverImageUrl: string | null;
  description: string | null;
  bookDbId: string | null;
  readingCount: number;
  completedCount: number;
  eventCount: number;
}

export default function BookSearchPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [source, setSource] = useState<string>("");
  const [dbBookCount, setDbBookCount] = useState<number>(0);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    title: "",
    author: "",
    publisher: "",
    totalPages: "",
    isbn: "",
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/books/search?q=${encodeURIComponent(query)}`));
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.books || []);
      setSource(data.meta?.source || "");
      setDbBookCount(data.meta?.dbBookCount || 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 学習シグナル送信（バックグラウンド）
  const sendFeedback = (isbn: string | null, rank: number, action: string) => {
    if (!query.trim()) return;
    fetch(apiUrl("/api/search/feedback"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim(), clickedIsbn: isbn, rankShown: rank, action }),
    }).catch(() => {});
  };

  const handleAddBook = async (book: SearchResult, index: number, status: string) => {
    if (!session) {
      router.push("/login");
      return;
    }
    setAddingIndex(index);
    // 学習シグナル: 登録アクション
    sendFeedback(book.isbn, index + 1, status === "COMPLETED" ? "read" : "registered");
    try {
      const registerRes = await fetch(apiUrl("/api/books"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book),
      });
      const { book: registeredBook } = await registerRes.json();

      const statusRes = await fetch(apiUrl("/api/me/readings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: registeredBook.id, status }),
      });

      if (statusRes.ok) {
        router.push(`/books/${registeredBook.id}`);
      } else {
        const err = await statusRes.json();
        if (err.error?.includes("既に")) {
          router.push(`/books/${registeredBook.id}`);
        } else {
          alert(err.error || "登録に失敗しました");
        }
      }
    } finally {
      setAddingIndex(null);
    }
  };

  const handleManualAdd = async (status: string) => {
    if (!session) {
      router.push("/login");
      return;
    }
    if (!manualForm.title.trim() || !manualForm.author.trim()) {
      alert("タイトルと著者名は必須です");
      return;
    }
    setManualSubmitting(true);
    try {
      const registerRes = await fetch(apiUrl("/api/books"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualForm.title.trim(),
          author: manualForm.author.trim(),
          publisher: manualForm.publisher.trim() || null,
          totalPages: parseInt(manualForm.totalPages) || 0,
          isbn: manualForm.isbn.trim() || null,
          coverImageUrl: manualForm.isbn.trim()
            ? `https://covers.openlibrary.org/b/isbn/${manualForm.isbn.trim()}-M.jpg`
            : null,
          description: null,
        }),
      });
      const { book: registeredBook } = await registerRes.json();

      const statusRes = await fetch(apiUrl("/api/me/readings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: registeredBook.id, status }),
      });

      if (statusRes.ok) {
        router.push(`/books/${registeredBook.id}`);
      } else {
        const err = await statusRes.json();
        if (err.error?.includes("既に")) {
          router.push(`/books/${registeredBook.id}`);
        } else {
          alert(err.error || "登録に失敗しました");
        }
      }
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">本を探す</h1>

      {/* 検索フォーム */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="書名、著者名、ISBNで検索"
          className="flex-1 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-4 py-3 text-base focus:border-[var(--color-accent)] focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? "検索中..." : "検索"}
        </button>
      </form>

      {/* 手動登録ボタン */}
      <div className="mb-6 text-right">
        <button
          onClick={() => setShowManual(!showManual)}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          {showManual ? "閉じる" : "検索で見つからない場合は手動で登録"}
        </button>
      </div>

      {/* 手動登録フォーム */}
      {showManual && (
        <div className="mb-8 card-base p-6">
          <h2 className="mb-4 font-serif text-lg font-medium text-[var(--color-ink-primary)]">本を手動で登録</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualForm.title}
                onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                placeholder="例: 人間失格"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">
                著者 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualForm.author}
                onChange={(e) => setManualForm({ ...manualForm, author: e.target.value })}
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                placeholder="例: 太宰治"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">
                出版社
              </label>
              <input
                type="text"
                value={manualForm.publisher}
                onChange={(e) => setManualForm({ ...manualForm, publisher: e.target.value })}
                className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                placeholder="例: 新潮社"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">
                  総ページ数
                </label>
                <input
                  type="number"
                  value={manualForm.totalPages}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, totalPages: e.target.value })
                  }
                  className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                  placeholder="例: 300"
                  min={0}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">
                  ISBN（任意）
                </label>
                <input
                  type="text"
                  value={manualForm.isbn}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, isbn: e.target.value })
                  }
                  className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                  placeholder="例: 9784101006055"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleManualAdd("READING")}
                disabled={manualSubmitting}
                className="btn-primary-sm disabled:opacity-50"
              >
                読み始める
              </button>
              <button
                onClick={() => handleManualAdd("COMPLETED")}
                disabled={manualSubmitting}
                className="border border-[rgb(184_71_60_/_0.4)] text-[var(--color-accent)] bg-transparent px-3.5 py-1.5 rounded text-xs tracking-[0.08em] hover:bg-[var(--color-accent-soft)] transition-colors disabled:opacity-50"
              >
                読了にする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 検索結果 */}
      {results.length > 0 && (
        <>
          <div className="space-y-4">
            {results.map((book, i) => (
              <div
                key={`${book.isbn || book.title}-${i}`}
                className="card-base flex gap-4 p-4"
              >
                {book.coverImageUrl ? (
                  <img
                    src={book.coverImageUrl}
                    alt={book.title}
                    className="h-32 w-22 shrink-0 rounded object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove(
                        "hidden"
                      );
                    }}
                  />
                ) : null}
                <div
                  className={`flex h-32 w-22 shrink-0 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-xs text-[var(--color-ink-faint)] ${book.coverImageUrl ? "hidden" : ""}`}
                >
                  No Image
                </div>
                <div className="flex flex-1 flex-col">
                  <h3 className="font-serif text-base font-medium text-[var(--color-ink-primary)]">{book.title}</h3>
                  <p className="text-sm text-[var(--color-ink-muted)]">{book.author}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {book.publisher && (
                      <p className="text-xs text-[var(--color-ink-faint)]">{book.publisher}</p>
                    )}
                    {book.publishedDate && (
                      <p className="text-xs text-[var(--color-ink-faint)]">{book.publishedDate}</p>
                    )}
                    {book.totalPages > 0 && (
                      <p className="text-xs text-[var(--color-ink-faint)]">{book.totalPages}ページ</p>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${book.readingCount > 0 ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "bg-[rgb(31_42_68_/_0.04)] text-[var(--color-ink-faint)]"}`}>
                      📖 {book.readingCount}人が読書中
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${book.completedCount > 0 ? "bg-[rgb(45_106_79_/_0.08)] text-[var(--color-status-success)]" : "bg-[rgb(31_42_68_/_0.04)] text-[var(--color-ink-faint)]"}`}>
                      ✅ {book.completedCount}人が読了
                    </span>
                    {book.bookDbId ? (
                      <Link
                        href={`/books/${book.bookDbId}#events`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${book.eventCount > 0 ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]" : "bg-[rgb(31_42_68_/_0.04)] text-[var(--color-ink-faint)]"}`}
                      >
                        📅 {book.eventCount}件の読書会
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(31_42_68_/_0.04)] px-2 py-0.5 text-xs text-[var(--color-ink-faint)]">
                        📅 0件の読書会
                      </span>
                    )}
                  </div>
                  {book.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--color-ink-muted)]">
                      {book.description}
                    </p>
                  )}
                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      onClick={() => handleAddBook(book, i, "READING")}
                      disabled={addingIndex === i}
                      className="btn-primary-sm disabled:opacity-50"
                    >
                      読み始める
                    </button>
                    <button
                      onClick={() => handleAddBook(book, i, "COMPLETED")}
                      disabled={addingIndex === i}
                      className="border border-[rgb(184_71_60_/_0.4)] text-[var(--color-accent)] bg-transparent px-3 py-1 rounded text-xs tracking-[0.08em] hover:bg-[var(--color-accent-soft)] transition-colors disabled:opacity-50"
                    >
                      読了にする
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && results.length === 0 && query && (
        <div className="card-base p-8 text-center">
          <p className="text-[var(--color-ink-muted)]">「{query}」の検索結果がありません</p>
          <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
            上の「手動で登録」から直接本を追加できます
          </p>
        </div>
      )}
    </div>
  );
}
