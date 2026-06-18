"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { updateTopicTags, updateTypes } from "@/lib/updates";
import { updateNoticeStatusLabels, updateNoticeStatuses } from "@/lib/update-notices";

type Props = {
  noticeId: string;
  initialTitle: string;
  initialBody: string;
  initialType: string;
  initialTopicTag: string;
  initialHref: string;
  initialStatus: string;
  initialDisplayDate: string;
};

export default function UpdateNoticeForm({
  noticeId,
  initialTitle,
  initialBody,
  initialType,
  initialTopicTag,
  initialHref,
  initialStatus,
  initialDisplayDate,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [type, setType] = useState(initialType);
  const [topicTag, setTopicTag] = useState(initialTopicTag);
  const [href, setHref] = useState(initialHref);
  const [status, setStatus] = useState(initialStatus);
  const [displayDate, setDisplayDate] = useState(initialDisplayDate);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (initialStatus !== "published" && status === "published") {
      const ok = window.confirm("/updates に公開されます。本当に公開しますか？");
      if (!ok) return;
    }

    if (initialStatus !== "archived" && status === "archived") {
      const ok = window.confirm("/updates には表示されなくなります。本当にアーカイブしますか？");
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/update-notices/${noticeId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          type,
          topicTag: topicTag || null,
          href: href || null,
          status,
          displayDate,
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

  async function handleDelete() {
    const ok = window.confirm("このお知らせを削除します。元に戻せません。本当に削除しますか？");
    if (!ok) return;

    setDeleting(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/admin/update-notices/${noticeId}`), {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "削除に失敗しました");
        return;
      }
      router.push("/admin/update-notices");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">お知らせを編集</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">
        公開中にすると /updates に表示されます。メール・DM・Push通知は送信されません。
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

        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {updateNoticeStatuses.map((option) => (
                <option key={option} value={option}>
                  {updateNoticeStatusLabels[option]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">種別</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {updateTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">内容タグ</span>
            <select
              value={topicTag}
              onChange={(event) => setTopicTag(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              <option value="">なし</option>
              {updateTopicTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">表示日</span>
            <input
              type="datetime-local"
              value={displayDate}
              onChange={(event) => setDisplayDate(event.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600">リンク 任意</span>
          <input
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="/updates/..."
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <span className="mt-1 block text-xs text-gray-400">
            /updates/... の詳細ページを指定した場合だけ、/updates のカードに「詳細」が表示されます。
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || deleting}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "保存中..." : "保存する"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting || deleting}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? "削除中..." : "削除する"}
          </button>
        </div>
      </form>

      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
