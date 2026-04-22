"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    totalPages: "",
    isbn: "",
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
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

  const handleAddBook = async (book: SearchResult, index: number, status: string) => {
    if (!session) {
      router.push("/login");
      return;
    }
    setAddingIndex(index);
    try {
      const registerRes = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book),
      });
      const { book: registeredBook } = await registerRes.json();

      const statusRes = await fetch("/api/me/readings", {
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
      const registerRes = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualForm.title.trim(),
          author: manualForm.author.trim(),
          totalPages: parseInt(manualForm.totalPages) || 0,
          isbn: manualForm.isbn.trim() || null,
          coverImageUrl: manualForm.isbn.trim()
            ? `https://covers.openlibrary.org/b/isbn/${manualForm.isbn.trim()}-M.jpg`
            : null,
          description: null,
        }),
      });
      const { book: registeredBook } = await registerRes.json();

      const statusRes = await fetch("/api/me/readings", {
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
      <h1 className="mb-6 text-2xl font-bold text-gray-900">本を探す</h1>

      {/* 検索フォーム */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="書名、著者名、ISBNで検索"
          className="flex-1 rounded-lg border px-4 py-2.5 focus:border-amber-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-amber-600 px-6 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? "検索中..." : "検索"}
        </button>
      </form>

      {/* 手動登録ボタン */}
      <div className="mb-6 text-right">
        <button
          onClick={() => setShowManual(!showManual)}
          className="text-sm text-amber-600 hover:underline"
        >
          {showManual ? "閉じる" : "検索で見つからない場合は手動で登録"}
        </button>
      </div>

      {/* 手動登録フォーム */}
      {showManual && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">本を手動で登録</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualForm.title}
                onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                className="w-full rounded-lg border bg-white px-3 py-2 focus:border-amber-400 focus:outline-none"
                placeholder="例: 人間失格"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                著者 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualForm.author}
                onChange={(e) => setManualForm({ ...manualForm, author: e.target.value })}
                className="w-full rounded-lg border bg-white px-3 py-2 focus:border-amber-400 focus:outline-none"
                placeholder="例: 太宰治"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  総ページ数
                </label>
                <input
                  type="number"
                  value={manualForm.totalPages}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, totalPages: e.target.value })
                  }
                  className="w-full rounded-lg border bg-white px-3 py-2 focus:border-amber-400 focus:outline-none"
                  placeholder="例: 300"
                  min={0}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  ISBN（任意）
                </label>
                <input
                  type="text"
                  value={manualForm.isbn}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, isbn: e.target.value })
                  }
                  className="w-full rounded-lg border bg-white px-3 py-2 focus:border-amber-400 focus:outline-none"
                  placeholder="例: 9784101006055"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleManualAdd("READING")}
                disabled={manualSubmitting}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                読み始める
              </button>
              <button
                onClick={() => handleManualAdd("COMPLETED")}
                disabled={manualSubmitting}
                className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
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
          {source === "external" && dbBookCount < 1000 && (
            <p className="mb-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-600">
              外部API検索で動作中（DB: {dbBookCount.toLocaleString()}冊）。
              <code className="rounded bg-blue-100 px-1 mx-1">npx tsx scripts/import-openbd.ts</code>
              でopenBD全件取り込みを実行すると、検索精度が大幅に向上します。
            </p>
          )}
          <div className="space-y-4">
            {results.map((book, i) => (
              <div
                key={`${book.isbn || book.title}-${i}`}
                className="flex gap-4 rounded-lg border bg-white p-4 shadow-sm"
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
                  className={`flex h-32 w-22 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400 ${book.coverImageUrl ? "hidden" : ""}`}
                >
                  No Image
                </div>
                <div className="flex flex-1 flex-col">
                  <h3 className="font-semibold text-gray-900">{book.title}</h3>
                  <p className="text-sm text-gray-500">{book.author}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {book.publisher && (
                      <p className="text-xs text-gray-400">{book.publisher}</p>
                    )}
                    {book.publishedDate && (
                      <p className="text-xs text-gray-400">{book.publishedDate}</p>
                    )}
                    {book.totalPages > 0 && (
                      <p className="text-xs text-gray-400">{book.totalPages}ページ</p>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${book.readingCount > 0 ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-400"}`}>
                      📖 {book.readingCount}人が読書中
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${book.completedCount > 0 ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"}`}>
                      ✅ {book.completedCount}人が読了
                    </span>
                    {book.bookDbId ? (
                      <Link
                        href={`/books/${book.bookDbId}#events`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${book.eventCount > 0 ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "bg-gray-50 text-gray-400"}`}
                      >
                        📅 {book.eventCount}件の読書会
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-400">
                        📅 0件の読書会
                      </span>
                    )}
                  </div>
                  {book.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                      {book.description}
                    </p>
                  )}
                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      onClick={() => handleAddBook(book, i, "READING")}
                      disabled={addingIndex === i}
                      className="rounded bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                    >
                      読み始める
                    </button>
                    <button
                      onClick={() => handleAddBook(book, i, "COMPLETED")}
                      disabled={addingIndex === i}
                      className="rounded bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
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
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-gray-500">「{query}」の検索結果がありません</p>
          <p className="mt-2 text-sm text-gray-400">
            上の「手動で登録」から直接本を追加できます
          </p>
          {dbBookCount < 1000 && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4 text-left text-xs text-gray-500">
              <p className="mb-2 font-semibold">
                検索精度を向上させるには:
              </p>
              <ol className="list-inside list-decimal space-y-1">
                <li>
                  <code className="rounded bg-gray-200 px-1">npx tsx scripts/import-openbd.ts</code> でopenBD全件取り込み（約100万冊・無料）
                </li>
                <li>
                  <code className="rounded bg-gray-200 px-1">npx tsx scripts/calculate-ranks.ts</code> でランキング計算
                </li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
