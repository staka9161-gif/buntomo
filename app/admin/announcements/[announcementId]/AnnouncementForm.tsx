"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

type Props = {
  announcementId: string;
  initialTitle: string;
  initialBody: string;
  initialLevel: string;
  initialStatus: string;
  initialExpiresAt: string;
};

const statusOptions = [
  { value: "draft", label: "下書き" },
  { value: "published", label: "公開中" },
  { value: "archived", label: "アーカイブ" },
];

const levelOptions = [
  { value: "important", label: "重要" },
  { value: "urgent", label: "緊急" },
  { value: "maintenance", label: "メンテナンス" },
];

export default function AnnouncementForm({
  announcementId,
  initialTitle,
  initialBody,
  initialLevel,
  initialStatus,
  initialExpiresAt,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [level, setLevel] = useState(initialLevel);
  const [status, setStatus] = useState(initialStatus);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (initialStatus !== "published" && status === "published") {
      const ok = window.confirm(
        "全ユーザー画面に表示されます。本当に公開しますか？",
      );
      if (!ok) return;
    }

    if (initialStatus !== "archived" && status === "archived") {
      const ok = window.confirm(
        "一般画面には表示されなくなります。本当にアーカイブしますか？",
      );
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/announcements/${announcementId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          level,
          status,
          expiresAt: expiresAt || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "保存に失敗しました");
        return;
      }

      setMessage("保存しました。");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">お知らせを編集</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">
        公開中にすると通常ページ上部に表示されます。メール・DM・Push通知は送信されません。
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">タイトル</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            required
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600">本文</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={10}
            maxLength={2000}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            required
          />
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">種別</span>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {levelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">終了日時 任意</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? "保存中..." : "保存する"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
