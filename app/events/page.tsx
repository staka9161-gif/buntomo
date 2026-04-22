"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import { PREFECTURES } from "@/lib/prefectures";

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
    displayName: string;
    avatarUrl: string | null;
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
      <h1 className="mb-6 text-2xl font-bold text-gray-900">読書会を探す</h1>

      {/* フィルタ */}
      <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="書名・著者・キーワードで検索"
            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
          <select
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          >
            <option value="">全国</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
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
        <p className="py-12 text-center text-gray-400">読み込み中...</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <p className="text-gray-500">該当する読書会が見つかりません</p>
          <p className="mt-1 text-sm text-gray-400">
            条件を変えて検索するか、本の詳細ページから読書会を登録できます
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="flex gap-4 p-5">
                {/* 書影（複数冊の場合は重ねて表示） */}
                <div className="shrink-0">
                  {(() => {
                    const displayBooks = event.books && event.books.length > 0 ? event.books : [event.book];
                    if (displayBooks.length === 1) {
                      const b = displayBooks[0];
                      return (
                        <Link href={`/books/${b.id}`}>
                          {b.coverImageUrl ? (
                            <img src={b.coverImageUrl} alt={b.title} className="h-24 w-16 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className="flex h-24 w-16 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400">No Image</div>
                          )}
                        </Link>
                      );
                    }
                    // 複数冊: 重ねて表示
                    return (
                      <div className="relative" style={{ width: `${16 + (displayBooks.length - 1) * 10}px`, height: "96px" }}>
                        {displayBooks.slice(0, 3).map((b, i) => (
                          <Link key={b.id} href={`/books/${b.id}`} className="absolute" style={{ left: `${i * 10}px`, zIndex: displayBooks.length - i }}>
                            {b.coverImageUrl ? (
                              <img src={b.coverImageUrl} alt={b.title} className="h-24 w-16 rounded object-cover border-2 border-white shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="flex h-24 w-16 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400 border-2 border-white shadow-sm">No Image</div>
                            )}
                          </Link>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{event.title}</h3>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {daysUntil(event.eventDate)}
                    </span>
                  </div>

                  {/* 対象書籍 */}
                  {event.books && event.books.length > 1 ? (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {event.books.map((b) => (
                        <Link key={b.id} href={`/books/${b.id}`} className="text-sm text-amber-600 hover:underline">
                          {b.title}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link
                      href={`/books/${event.book.id}`}
                      className="mt-0.5 block text-sm text-amber-600 hover:underline"
                    >
                      {event.book.title}
                      <span className="ml-1 text-gray-400">/ {event.book.author}</span>
                    </Link>
                  )}

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span>📅 {formatDate(event.eventDate)}</span>
                    <span>📍 {event.prefecture} {event.location}</span>
                    <span>👤 {event.organizer.displayName}</span>
                  </div>

                  {event.description && (
                    <p className="mt-2 text-xs text-gray-500 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>

                {/* 参加ボタン */}
                {event.url && (
                  <div className="flex shrink-0 items-center">
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      詳細・申込
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
