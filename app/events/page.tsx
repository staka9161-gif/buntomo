"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api";
import { PREFECTURES_SEARCH } from "@/lib/prefectures";
import ReadingEventInterestButton from "@/components/events/ReadingEventInterestButton";

interface BookInfo {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
}

interface EventItem {
  id: string;
  title: string;
  eventDate: string;
  prefecture: string;
  location: string;
  url: string | null;
  description: string | null;
  book: BookInfo;
  books?: BookInfo[];
  organizer: {
    id: string;
    name: string;
    image: string | null;
  };
}

function buildMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ value, label });
  }
  return options;
}

export default function EventsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [month, setMonth] = useState("");
  const monthOptions = buildMonthOptions();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (prefecture) params.set("prefecture", prefecture);
    if (month) params.set("month", month);

    try {
      const res = await fetch(apiUrl(`/api/events?${params.toString()}`));
      const data = await res.json();
      setEvents(data.events || []);
    } finally {
      setLoading(false);
    }
  }, [query, prefecture, month]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short",
      }) +
      " " +
      d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const daysUntil = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "今日";
    if (days === 1) return "明日";
    return `あと${days}日`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">読書会を探す</h1>

      {/* フィルタ */}
      <div className="mb-6 card-base p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="書名・著者・キーワードで検索"
            className="flex-1 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          />
          <select
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          >
            <option value="">全国</option>
            {PREFECTURES_SEARCH.map((p) => (
              <option key={p} value={p}>
                {p === "東京都" ? "東京都(全域)" : p}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          >
            <option value="">全期間</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 結果 */}
      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--color-ink-faint)]">読み込み中...</p>
      ) : events.length === 0 ? (
        <div className="card-base p-12 text-center">
          <p className="text-[var(--color-ink-muted)]">該当する読書会が見つかりません</p>
          <p className="mt-1 text-sm text-[var(--color-ink-faint)]">
            条件を変えて検索するか、本の詳細ページから読書会を登録できます
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="card-base p-4 transition hover:shadow-md"
            >
              {/* 上段: 書影 + タイトル + バッジ */}
              <div className="flex gap-3">
                <div className="shrink-0">
                  {(() => {
                    const displayBooks = event.books && event.books.length > 0 ? event.books : [event.book];
                    if (displayBooks.length === 1) {
                      const b = displayBooks[0];
                      return (
                        <Link href={`/books/${b.id}`}>
                          {b.coverImageUrl ? (
                            <img src={b.coverImageUrl} alt={b.title} className="h-18 w-12 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className="flex h-18 w-12 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-[9px] text-[var(--color-ink-faint)]">No Image</div>
                          )}
                        </Link>
                      );
                    }
                    return (
                      <div className="relative" style={{ width: `${48 + (displayBooks.length - 1) * 10}px`, height: "72px" }}>
                        {displayBooks.slice(0, 3).map((b, i) => (
                          <Link key={b.id} href={`/books/${b.id}`} className="absolute" style={{ left: `${i * 10}px`, zIndex: displayBooks.length - i }}>
                            {b.coverImageUrl ? (
                              <img src={b.coverImageUrl} alt={b.title} className="h-18 w-12 rounded object-cover border-2 border-white shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="flex h-18 w-12 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-[9px] text-[var(--color-ink-faint)] border-2 border-white shadow-sm">No Image</div>
                            )}
                          </Link>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h3 className="font-serif text-sm font-medium text-[var(--color-ink-primary)] line-clamp-2 md:text-base">{event.title}</h3>
                    <span className="mt-0.5 shrink-0 rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                      {daysUntil(event.eventDate)}
                    </span>
                  </div>
                  <Link
                    href={`/books/${event.book.id}`}
                    className="mt-0.5 block truncate text-xs text-[var(--color-accent)] hover:underline"
                  >
                    {event.book.title}<span className="ml-1 text-[var(--color-ink-faint)]">/ {event.book.author}</span>
                  </Link>
                </div>
              </div>

              {/* メタ情報 */}
              <div className="mt-2 space-y-0.5 text-xs text-[var(--color-ink-muted)]">
                <p>📅 {formatDate(event.eventDate)}</p>
                <p className="line-clamp-2">📍 {event.prefecture} {event.location}</p>
                <p className="truncate">
                  <a href={`/users/${event.organizer.id}`} className="text-[var(--color-accent)] hover:underline">👤 {event.organizer.name}</a>
                </p>
              </div>
              <div className="mt-2">
                <ReadingEventInterestButton
                  eventId={event.id}
                  isOrganizer={session?.user?.id === event.organizer.id}
                />
              </div>

              {event.description && (
                <p className="mt-1.5 text-xs text-[var(--color-ink-faint)] line-clamp-2">
                  {event.description}
                </p>
              )}

              {/* 参加ボタン（全幅） */}
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block w-full text-center btn-primary-sm"
                >
                  詳細・申込
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
