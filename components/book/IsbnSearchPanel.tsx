"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiUrl } from "@/lib/api";
import { normalizeLookupIsbn } from "@/lib/isbn";
import type { IsbnLookupBook } from "@/lib/isbn-lookup";

function returnUrl(params: URLSearchParams, isbn: string) {
  const next = new URLSearchParams(params);
  next.delete("returnTo");
  if (next.get("mode") === "isbn") {
    next.delete("mode");
    next.delete("q");
  }
  next.set("isbn", isbn);
  return `/books/search?${next.toString()}`;
}

export default function IsbnSearchPanel() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlIsbn = searchParams.get("isbn") ?? (searchParams.get("mode") === "isbn" ? searchParams.get("q") ?? "" : "");
  const [input, setInput] = useState("");
  const [searchedIsbn, setSearchedIsbn] = useState("");
  const [book, setBook] = useState<IsbnLookupBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const restoredIsbnRef = useRef<string | null>(null);
  const pendingScrollRef = useRef<string | null>(null);
  const addingRef = useRef(false);

  const lookup = useCallback(async (isbn: string, restoreUrl?: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    pendingScrollRef.current = null;
    setError("");
    setBook(null);
    setSearchedIsbn(isbn);
    if (!normalizeLookupIsbn(isbn)) {
      setError("有効なISBN（10桁または13桁）を入力してください。");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/books/isbn?isbn=${encodeURIComponent(isbn)}`), { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ISBN検索に失敗しました。");
      if (controller.signal.aborted) return;
      setBook(data.books?.[0] ?? null);
      pendingScrollRef.current = restoreUrl ?? null;
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "ISBN検索に失敗しました。");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (restoredIsbnRef.current === urlIsbn) return;
    restoredIsbnRef.current = urlIsbn;
    startTransition(() => {
      setInput(urlIsbn);
      if (urlIsbn.trim()) {
        void lookup(urlIsbn, returnUrl(new URLSearchParams(searchParams.toString()), urlIsbn));
      } else {
        requestRef.current?.abort();
        setBook(null);
        setSearchedIsbn("");
        setError("");
        setLoading(false);
      }
    });
  }, [lookup, searchParams, urlIsbn]);

  useEffect(() => () => {
    requestRef.current?.abort();
    restoredIsbnRef.current = null;
  }, []);

  useEffect(() => {
    if (loading || !book || !pendingScrollRef.current) return;
    const key = `bookSearch:scrollY:${encodeURIComponent(pendingScrollRef.current)}`;
    pendingScrollRef.current = null;
    try {
      const saved = Number(sessionStorage.getItem(key));
      if (Number.isFinite(saved) && saved > 0) {
        const frame = requestAnimationFrame(() => window.scrollTo({ top: saved }));
        return () => cancelAnimationFrame(frame);
      }
    } catch {
      // Search remains usable when sessionStorage is unavailable.
    }
  }, [book, loading]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const isbn = input.trim();
    if (!isbn) return;
    if (normalizeLookupIsbn(isbn)) {
      restoredIsbnRef.current = isbn;
      window.history.replaceState(null, "", returnUrl(new URLSearchParams(window.location.search), isbn));
    }
    await lookup(isbn);
  };

  const currentReturnUrl = returnUrl(new URLSearchParams(searchParams.toString()), searchedIsbn);
  const rememberScroll = () => {
    try {
      sessionStorage.setItem(`bookSearch:scrollY:${encodeURIComponent(currentReturnUrl)}`, String(window.scrollY));
    } catch {
      // Search remains usable when sessionStorage is unavailable.
    }
  };
  const detailPath = book?.bookDbId ? `/books/${book.bookDbId}` : book?.workDbId ? `/works/${book.workDbId}` : null;

  const addBook = async (status: "READING" | "COMPLETED") => {
    if (!book || addingRef.current) return;
    if (!session) { router.push("/login"); return; }
    addingRef.current = true;
    setAdding(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/api/books"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(book),
      });
      const registered = await response.json();
      if (!response.ok || !registered.book?.id) throw new Error(registered.error || "登録に失敗しました");
      const readingResponse = await fetch(apiUrl("/api/me/readings"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: registered.book.id, status }),
      });
      const reading = await readingResponse.json();
      if (!readingResponse.ok && !reading.error?.includes("既に")) throw new Error(reading.error || "登録に失敗しました");
      rememberScroll();
      router.push(`/books/${registered.book.id}?returnTo=${encodeURIComponent(currentReturnUrl)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登録に失敗しました");
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };

  return (
    <section aria-label="ISBN検索" className="min-w-0 space-y-3">
      <form onSubmit={handleSearch} aria-label="ISBN検索フォーム">
        <label htmlFor="book-isbn" className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">ISBNで検索</label>
        <div className="flex gap-2">
          <input id="book-isbn" type="text" value={input} onChange={event => setInput(event.target.value)}
            placeholder="例: 9784101006024" maxLength={128} autoCapitalize="characters"
            className="min-w-0 flex-1 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-3 text-base focus:border-[var(--color-accent)] focus:outline-none transition-colors" />
          <button type="submit" disabled={loading || adding}
            className="shrink-0 whitespace-nowrap rounded border border-[var(--color-border-subtle)] px-3 py-2 text-sm text-[var(--color-ink-primary)] transition-colors hover:bg-[var(--color-accent-soft)] disabled:opacity-50">
            {loading ? "検索中..." : "ISBN検索"}
          </button>
        </div>
      </form>
      {loading && <p role="status" className="text-sm text-[var(--color-ink-muted)]">ISBNを検索中...</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!loading && !error && searchedIsbn && !book && <p className="text-sm text-[var(--color-ink-muted)]">ISBN「{searchedIsbn}」に一致する書籍が見つかりませんでした</p>}
      {book && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-[var(--color-ink-primary)]">ISBN検索の結果</h2>
          <article className="card-base flex min-w-0 gap-4 p-4">
            {book.coverImageUrl ? <Image src={book.coverImageUrl} alt={book.title} width={88} height={128} unoptimized
              className="h-32 w-22 shrink-0 rounded object-cover" /> : <div className="flex h-32 w-22 shrink-0 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-xs text-[var(--color-ink-faint)]">No Image</div>}
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-base font-medium text-[var(--color-ink-primary)]">{book.title}</h3>
              <p className="text-sm text-[var(--color-ink-muted)]">{book.author}</p>
              <p className="mt-1 break-all text-xs text-[var(--color-ink-faint)]">ISBN: {book.isbn}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--color-ink-faint)]">
                {book.publisher && <span>{book.publisher}</span>}
                {book.publishedDate && <span>{book.publishedDate}</span>}
                {book.totalPages > 0 && <span>{book.totalPages}ページ</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--color-ink-muted)]">
                <span>読書中 {book.readingCount}人</span>
                <span>読了 {book.completedCount}人</span>
                {book.bookDbId && <Link href={`/books/${book.bookDbId}?returnTo=${encodeURIComponent(currentReturnUrl)}#events`} onClick={rememberScroll} className="hover:text-[var(--color-accent)]">読書会 {book.eventCount}件</Link>}
              </div>
              {book.description && <p className="mt-1 line-clamp-2 text-xs text-[var(--color-ink-muted)]">{book.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {detailPath && <Link href={`${detailPath}?returnTo=${encodeURIComponent(currentReturnUrl)}`} onClick={rememberScroll}
                  className="inline-flex min-h-8 items-center whitespace-nowrap rounded border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]">
                  {book.bookDbId ? "本ページを見る" : "作品ページを見る"}
                </Link>}
                <button type="button" onClick={() => addBook("READING")} disabled={adding} className="btn-primary-sm whitespace-nowrap disabled:opacity-50">読み始める</button>
                <button type="button" onClick={() => addBook("COMPLETED")} disabled={adding} className="btn-secondary-sm whitespace-nowrap disabled:opacity-50">読了にする</button>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
