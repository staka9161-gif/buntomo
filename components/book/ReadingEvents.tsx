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
    name: string;
    image: string | null;
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
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("13:00");
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
    if (!form.title.trim() || !formDate || !form.prefecture || !form.location.trim() || !form.url.trim()) return;
    // ローカル時刻をUTC ISO文字列に変換してサーバーに送信
    const eventDate = new Date(`${formDate}T${formTime || "13:00"}`).toISOString();
    setSubmitting(true);
    try {
      const payload = { ...form, eventDate, bookIds: [...selectedBookIds] };
      if (editingId) {
        const res = await fetch(apiUrl(`/api/events/${editingId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setEditingId(null);
          setForm({ ...EMPTY_FORM });
          setFormDate("");
          setFormTime("13:00");
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
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setForm({ ...EMPTY_FORM });
          setFormDate("");
          setFormTime("13:00");
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
    setFormDate(local.slice(0, 10));
    setFormTime(local.slice(11, 16));
    setForm({
      title: event.title,
      eventDate: local,
      prefecture: event.prefecture,
      location: event.location,
      url: event.url || "",
      description: event.description || "",
    });
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
    setFormDate("");
    setFormTime("13:00");
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
      <div className="card-base p-3">
        <h3 className="mb-2 font-serif text-xs font-medium text-[var(--color-ink-muted)] uppercase tracking-wide">
          読書会 {events.length > 0 && <span className="ml-1 rounded-full bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--color-accent)] normal-case">{events.length}</span>}
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-[var(--color-ink-faint)]">予定なし</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] p-2.5">
                {event.books && event.books.length > 0 && (
                  <p className="text-[10px] text-[var(--color-accent)] mb-0.5 truncate">
                    📖 {event.books[0].title}
                  </p>
                )}
                <p className="text-xs font-semibold text-[var(--color-ink-primary)] leading-tight">{event.title}</p>
                <div className="mt-1.5 space-y-0.5 text-[11px] text-[var(--color-ink-muted)]">
                  <p>📅 {formatDate(event.eventDate)}</p>
                  <p>📍 {event.prefecture} {event.location}</p>
                  <p><a href={`/users/${event.organizer.id}`} className="text-[var(--color-accent)] hover:underline">👤 {event.organizer.name}</a></p>
                </div>
                {event.url && (
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block btn-primary-sm text-center text-[11px]"
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
      <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-[var(--color-ink-primary)]">
        <span>対象の本</span>
        <span className="text-xs text-[var(--color-ink-faint)]">{selectedBookIds.size}冊選択中</span>
      </label>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {/* 現在の本（常に選択、外せない） */}
        <label className="flex items-center gap-2.5 rounded border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-2 cursor-default">
          <input
            type="checkbox"
            checked={true}
            disabled
            className="accent-[var(--color-accent)]"
          />
          <span className="text-sm text-[var(--color-ink-primary)] truncate">この本（現在のページ）</span>
        </label>
        {/* 別版（チェックボックス） */}
        {editions.map((ed) => (
          <label
            key={ed.id}
            className={`flex items-center gap-2.5 rounded border p-2 cursor-pointer transition ${
              selectedBookIds.has(ed.id)
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-border-subtle)] hover:border-[var(--color-border-faint)]"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedBookIds.has(ed.id)}
              onChange={() => toggleBook(ed.id)}
              className="accent-[var(--color-accent)]"
            />
            <div className="flex items-center gap-2 min-w-0">
              {ed.coverImageUrl ? (
                <img
                  src={ed.coverImageUrl}
                  alt=""
                  className="h-8 w-6 shrink-0 rounded-sm object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="h-8 w-6 shrink-0 rounded-sm bg-[rgb(31_42_68_/_0.05)]" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-ink-primary)] truncate">{ed.title}</p>
                <p className="text-[11px] text-[var(--color-ink-faint)] truncate">{ed.author}{ed.isbn ? ` / ${ed.isbn}` : ""}</p>
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );

  const formUI = showForm && (
    <form onSubmit={handleSubmit} className="mb-5 space-y-3 card-base p-4">
      {bookSelector}
      <div>
        <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-[var(--color-ink-primary)]">
          <span>読書会タイトル <span className="text-[var(--color-accent)]">*</span></span>
          <span className="text-xs text-[var(--color-ink-faint)]">{form.title.length}/20</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          maxLength={20}
          placeholder="例: 『人間失格』を語る会"
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">
          日時 <span className="text-[var(--color-accent)]">*</span>
        </label>
        <input
          type="datetime-local"
          value={formDate && formTime ? `${formDate}T${formTime}` : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) {
              setFormDate(v.slice(0, 10));
              setFormTime(v.slice(11, 16));
            }
          }}
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">
          都道府県 <span className="text-[var(--color-accent)]">*</span>
        </label>
        <select
          value={form.prefecture}
          onChange={(e) => setForm((prev) => ({ ...prev, prefecture: e.target.value }))}
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          required
        >
          {PREFECTURES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-[var(--color-ink-primary)]">
          <span>場所の詳細 <span className="text-[var(--color-accent)]">*</span></span>
          <span className="text-xs text-[var(--color-ink-faint)]">{form.location.length}/25</span>
        </label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
          maxLength={25}
          placeholder="例: 渋谷 TSUTAYA カフェ"
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">参加リンク <span className="text-[var(--color-accent)]">*</span></label>
        <input
          type="url"
          value={form.url}
          onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
          placeholder="https://..."
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-[var(--color-ink-primary)]">
          <span>備考（任意）</span>
          <span className="text-xs text-[var(--color-ink-faint)]">{form.description.length}/40</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          maxLength={40}
          rows={1}
          className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
        />
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary-sm disabled:opacity-50"
        >
          {submitting ? "処理中..." : editingId ? "更新する" : "読書会を登録"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={handleCancel}
            className="btn-secondary-sm"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className="card-base p-6">
      {bookTitle && (
        <p className="mb-2 text-sm font-medium text-[var(--color-ink-primary)]">📖 {bookTitle}</p>
      )}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-sm font-medium text-[var(--color-ink-primary)]">
          読書会の予定 {events.length > 0 && <span className="ml-1 rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs text-[var(--color-accent)]">{events.length}</span>}
        </h3>
        {session && !showForm && (
          <button
            onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setSelectedBookIds(new Set([bookId])); setShowForm(true); }}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            + 読書会を登録
          </button>
        )}
        {showForm && !editingId && (
          <button onClick={handleCancel} className="text-xs text-[var(--color-ink-faint)] hover:underline">
            閉じる
          </button>
        )}
      </div>

      {formUI}

      {events.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-faint)]">開催予定の読書会はありません</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className={`rounded border px-3 py-2 ${
                event.isOtherEdition
                  ? "border-[var(--color-border-subtle)] bg-[rgb(31_42_68_/_0.03)]"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {event.books && event.books.length > 0 && (
                    <p className="text-[11px] text-[var(--color-accent)] truncate mb-0.5">
                      📖 {event.books[0].title}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-semibold text-[var(--color-ink-primary)] truncate">{event.title}</h4>
                    <span className="shrink-0 rounded-full bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                      {daysUntil(event.eventDate)}
                    </span>
                    {event.isOtherEdition && (
                      <span className="shrink-0 rounded-full bg-[rgb(31_42_68_/_0.08)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-ink-muted)]">
                        別版
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--color-ink-muted)]">
                    <span>📅 {formatDate(event.eventDate)}</span>
                    <span>📍 {event.prefecture} {event.location}</span>
                    <a href={`/users/${event.organizer.id}`} className="text-[var(--color-accent)] hover:underline">👤 {event.organizer.name}</a>
                  </div>
                  {event.description && (
                    <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{event.description}</p>
                  )}
                  {isMyEvent(event) && (
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={() => handleEdit(event)}
                        className="btn-secondary-sm text-[11px]"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="btn-secondary-sm text-[var(--color-accent)] border-[rgb(184_71_60_/_0.4)] hover:bg-[var(--color-accent-soft)] text-[11px]"
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
                    className="shrink-0 btn-primary-sm text-[11px]"
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
