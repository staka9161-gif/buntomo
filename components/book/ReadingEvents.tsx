"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PREFECTURES } from "@/lib/prefectures";
import { apiUrl } from "@/lib/api";

interface BookInfo {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
}

interface ReadingEvent {
  id: string;
  title: string;
  eventDate: string;
  prefecture: string;
  location: string;
  url: string | null;
  description: string | null;
  organizer: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  books?: BookInfo[];
  isOtherEdition?: boolean;
}

interface Edition {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  coverImageUrl: string | null;
}

const EMPTY_FORM = {
  title: "",
  eventDate: "",
  prefecture: "東京都",
  location: "",
  url: "",
  description: "",
};

export default function ReadingEvents({ bookId, bookTitle, compact = false }: { bookId: string; bookTitle?: string; compact?: boolean }) {
  const { data: session } = useSession();
  const [events, setEvents] = useState<ReadingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set([bookId]));

  const fetchEvents = async () => {
    try {
      const res = await fetch(apiUrl(`/api/books/${bookId}/events`));
      const data = await res.json();
      setEvents(data.events || []);
    } finally {
      setLoading(false);
    }
  };

  const fetchEditions = async () => {
    try {
      const res = await fetch(apiUrl(`/api/books/${bookId}/editions`));
      const data = await res.json();
      setEditions(data.editions || []);
    } catch {
      // 別版取得失敗は無視
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchEditions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const isMyEvent = (event: ReadingEvent) => session?.user?.id === event.organizer.id;

  const toggleBook = (id: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev);
      // 現在のページの本は常に選択状態
      if (id === bookId) return next;
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.eventDate || !form.prefecture || !form.location.trim() || !form.url.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await fetch(apiUrl(`/api/events/${editingId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            bookIds: [...selectedBookIds],
          }),
        });
        if (res.ok) {
          setEditingId(null);
          setForm({ ...EMPTY_FORM });
          setShowForm(false);
          fetchEvents();
        } else {
          const err = await res.json();
          alert(err.error || "更新に失敗しました");
        }
      } else {
        const res = await fetch(apiUrl(`/api/books/${bookId}/events`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            bookIds: [...selectedBookIds],
          }),
        });
        if (res.ok) {
          setForm({ ...EMPTY_FORM });
          setSelectedBookIds(new Set([bookId]));
          setShowForm(false);
          fetchEvents();
        } else {
          const err = await res.json();
          alert(err.error || "登録に失敗しました");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (event: ReadingEvent) => {
    const d = new Date(event.eventDate);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({
      title: event.title,
      eventDate: local,
      prefecture: event.prefecture,
      location: event.location,
      url: event.url || "",
      description: event.description || "",
    });
    // 編集時に既存の対象本を復元
    const ids = event.books?.map((b) => b.id) || [];
    setSelectedBookIds(new Set(ids.length > 0 ? ids : [bookId]));
    setEditingId(event.id);
    setShowForm(true);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("この読書会を削除しますか？")) return;
    const res = await fetch(apiUrl(`/api/events/${eventId}`), { method: "DELETE" });
    if (res.ok) {
      fetchEvents();
    } else {
      const err = await res.json();
      alert(err.error || "削除に失敗しました");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setSelectedBookIds(new Set([bookId]));
    setShowForm(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }) + " " + d.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const daysUntil = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "今日";
    if (days === 1) return "明日";
    return `あと${days}日`;
  };

  if (loading) return null;

  // ---- compact モード ----
  if (compact) {
    return (
      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <h3 className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          読書会 {events.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 normal-case">{events.length}</span>}
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-gray-400">予定なし</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded border border-blue-100 bg-blue-50 p-2.5">
                {event.books && event.books.length > 0 && (
                  <p className="text-[10px] text-amber-700 mb-0.5 truncate">
                    📖 {event.books[0].title}
                  </p>
                )}
                <p className="text-xs font-semibold text-gray-800 leading-tight">{event.title}</p>
                <div className="mt-1.5 space-y-0.5 text-[11px] text-gray-500">
                  <p>📅 {formatDate(event.eventDate)}</p>
                  <p>📍 {event.prefecture} {event.location}</p>
                  <p><a href={`/users/${event.organizer.id}`} className="text-amber-700 hover:underline">👤 {event.organizer.displayName}</a></p>
                </div>
                {event.url && (
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block rounded bg-blue-600 px-2 py-0.5 text-center text-[11px] font-semibold text-white hover:bg-blue-700"
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

  // ---- 通常モード ----

  // 対象の本セレクタ（別版がある場合のみ表示）
  const bookSelector = editions.length > 0 && (
    <div className="mb-3">
      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-700">
        <span>対象の本</span>
        <span className="text-gray-400">{selectedBookIds.size}冊選択中</span>
      </label>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {/* 現在の本（常に選択、外せない） */}
        <label className="flex items-center gap-2.5 rounded-lg border border-amber-400 bg-amber-50 p-2 cursor-default">
          <input
            type="checkbox"
            checked={true}
            disabled
            className="accent-amber-600"
          />
          <span className="text-sm text-gray-800 truncate">この本（現在のページ）</span>
        </label>
        {/* 別版（チェックボックス） */}
        {editions.map((ed) => (
          <label
            key={ed.id}
            className={`flex items-center gap-2.5 rounded-lg border p-2 cursor-pointer transition ${
              selectedBookIds.has(ed.id)
                ? "border-amber-400 bg-amber-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedBookIds.has(ed.id)}
              onChange={() => toggleBook(ed.id)}
              className="accent-amber-600"
            />
            <div className="flex items-center gap-2 min-w-0">
              {ed.coverImageUrl ? (
                <img
                  src={ed.coverImageUrl}
                  alt=""
                  className="h-8 w-6 shrink-0 rounded object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="h-8 w-6 shrink-0 rounded bg-gray-100" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate">{ed.title}</p>
                <p className="text-[11px] text-gray-400 truncate">{ed.author}{ed.isbn ? ` / ${ed.isbn}` : ""}</p>
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );

  const formUI = showForm && (
    <form onSubmit={handleSubmit} className="mb-5 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      {bookSelector}
      <div>
        <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-700">
          <span>読書会タイトル <span className="text-red-500">*</span></span>
          <span className="text-gray-400">{form.title.length}/20</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          maxLength={20}
          placeholder="例: 『人間失格』を語る会"
          className="w-full rounded border bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          日時 <span className="text-red-500">*</span>
        </label>
        <input
          type="datetime-local"
          value={form.eventDate}
          onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
          className="w-full rounded border bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
          required
        />
      </div>
      <div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            都道府県 <span className="text-red-500">*</span>
          </label>
          <select
            value={form.prefecture}
            onChange={(e) => setForm({ ...form, prefecture: e.target.value })}
            className="w-full rounded border bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
            required
          >
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-700">
          <span>場所の詳細 <span className="text-red-500">*</span></span>
          <span className="text-gray-400">{form.location.length}/25</span>
        </label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          maxLength={25}
          placeholder="例: 渋谷 TSUTAYA カフェ"
          className="w-full rounded border bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">参加リンク <span className="text-red-500">*</span></label>
        <input
          type="url"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="https://..."
          className="w-full rounded border bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-700">
          <span>備考（任意）</span>
          <span className="text-gray-400">{form.description.length}/40</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={40}
          rows={1}
          className="w-full rounded border bg-white px-3 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {submitting ? "処理中..." : editingId ? "更新する" : "読書会を登録"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded bg-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-300"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      {bookTitle && (
        <p className="mb-2 text-sm font-semibold text-gray-900">📖 {bookTitle}</p>
      )}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          読書会の予定 {events.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{events.length}</span>}
        </h3>
        {session && !showForm && (
          <button
            onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setSelectedBookIds(new Set([bookId])); setShowForm(true); }}
            className="text-xs text-amber-600 hover:underline"
          >
            + 読書会を登録
          </button>
        )}
        {showForm && !editingId && (
          <button onClick={handleCancel} className="text-xs text-gray-400 hover:underline">
            閉じる
          </button>
        )}
      </div>

      {formUI}

      {events.length === 0 ? (
        <p className="text-sm text-gray-400">開催予定の読書会はありません</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className={`rounded border px-3 py-2 ${
                event.isOtherEdition
                  ? "border-purple-100 bg-purple-50"
                  : "border-blue-100 bg-blue-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {event.books && event.books.length > 0 && (
                    <p className="text-[11px] text-amber-700 truncate mb-0.5">
                      📖 {event.books[0].title}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{event.title}</h4>
                    <span className="shrink-0 rounded-full bg-blue-200 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
                      {daysUntil(event.eventDate)}
                    </span>
                    {event.isOtherEdition && (
                      <span className="shrink-0 rounded-full bg-purple-200 px-1.5 py-0.5 text-[10px] font-medium text-purple-800">
                        別版
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                    <span>📅 {formatDate(event.eventDate)}</span>
                    <span>📍 {event.prefecture} {event.location}</span>
                    <a href={`/users/${event.organizer.id}`} className="text-amber-700 hover:underline">👤 {event.organizer.displayName}</a>
                  </div>
                  {event.description && (
                    <p className="mt-1 text-xs text-gray-400">{event.description}</p>
                  )}
                  {isMyEvent(event) && (
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={() => handleEdit(event)}
                        className="rounded bg-white px-1.5 py-0.5 text-[11px] text-gray-500 border border-gray-200 hover:bg-gray-50"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="rounded bg-white px-1.5 py-0.5 text-[11px] text-red-500 border border-red-200 hover:bg-red-50"
                      >
                        削除
                      </button>
                    </div>
                  )}
                </div>
                {event.url && (
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                  >
                    詳細・申込
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
