"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/api";

type Announcement = {
  id: string;
  title: string;
  status: string;
  level: string;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AnnouncementListResponse = {
  announcements: Announcement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "draft", label: "下書き" },
  { value: "published", label: "公開中" },
  { value: "archived", label: "アーカイブ" },
];

const levelOptions = [
  { value: "important", label: "重要" },
  { value: "urgent", label: "緊急" },
  { value: "maintenance", label: "メンテナンス" },
];

const statusLabels: Record<string, string> = {
  draft: "下書き",
  published: "公開中",
  archived: "アーカイブ",
};

const levelLabels: Record<string, string> = {
  important: "重要",
  urgent: "緊急",
  maintenance: "メンテナンス",
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildHref(params: { status: string; page: number; pageSize: number }) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page !== 1) search.set("page", String(params.page));
  if (params.pageSize !== 20) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  return query ? `/admin/announcements?${query}` : "/admin/announcements";
}

export default function AdminAnnouncementsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl px-4 py-8">
          <div className="rounded-lg border bg-white px-4 py-12 text-center text-sm text-gray-500">
            読み込み中...
          </div>
        </main>
      }
    >
      <AdminAnnouncementsContent />
    </Suspense>
  );
}

function AdminAnnouncementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "20") || 20;

  const [data, setData] = useState<AnnouncementListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState("important");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    fetch(apiUrl(`/api/admin/announcements?${params.toString()}`), {
      cache: "no-store",
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "読み込みに失敗しました");
        return json as AnnouncementListResponse;
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, pageSize, status]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(apiUrl("/api/admin/announcements"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          level,
          expiresAt: expiresAt || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "作成に失敗しました");
        return;
      }
      router.push(`/admin/announcements/${json.announcement.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="border-b pb-5">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="hover:text-amber-700 hover:underline">
            管理画面
          </Link>
          <span className="mx-2">/</span>
          重要なお知らせ
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">重要なお知らせ</h1>
        <p className="mt-2 text-sm text-gray-500">
          全体に表示する重要なお知らせを管理します。メール・DM・Push通知は送信しません。
        </p>
      </div>

      <section className="mt-6 rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">下書きを作成</h2>
        <form onSubmit={handleCreate} className="mt-4 grid gap-4">
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
              maxLength={2000}
              rows={5}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              required
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
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
            className="w-fit rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "作成中..." : "下書きを作成"}
          </button>
        </form>
      </section>

      <form className="mt-6 rounded-lg border bg-white p-4 shadow-sm" action="/admin/announcements">
        <div className="grid gap-3 md:grid-cols-[180px_140px_auto]">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">status</span>
            <select
              name="status"
              defaultValue={status}
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
            <span className="text-xs font-semibold text-gray-600">表示件数</span>
            <select
              name="pageSize"
              defaultValue={String(pageSize)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {[20, 30, 50].map((size) => (
                <option key={size} value={size}>
                  {size}件
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
            >
              絞り込む
            </button>
            <Link
              href="/admin/announcements"
              className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              解除
            </Link>
          </div>
        </div>
      </form>

      {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="mt-5 rounded-lg border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-sm text-gray-600">
            {data?.total ?? 0}件中 {data?.announcements.length ?? 0}件を表示
          </p>
          <p className="text-xs text-gray-400">公開してもメール・DM・Push通知は送信されません。</p>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">読み込み中...</div>
        ) : data?.announcements.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">タイトル</th>
                  <th className="px-4 py-3">status</th>
                  <th className="px-4 py-3">種別</th>
                  <th className="px-4 py-3">公開日時</th>
                  <th className="px-4 py-3">終了日時</th>
                  <th className="px-4 py-3">作成日時</th>
                  <th className="px-4 py-3">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.announcements.map((announcement) => (
                  <tr key={announcement.id} className="align-top">
                    <td className="px-4 py-3 font-semibold text-gray-900">{announcement.title}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {statusLabels[announcement.status] ?? announcement.status}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {levelLabels[announcement.level] ?? announcement.level}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDateTime(announcement.publishedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDateTime(announcement.expiresAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDateTime(announcement.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/announcements/${announcement.id}`}
                        className="font-semibold text-amber-700 hover:underline"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            重要なお知らせはありません。
          </div>
        )}
      </section>

      <nav className="mt-5 flex items-center justify-between text-sm">
        <Link
          href={buildHref({ status, page: Math.max(1, page - 1), pageSize })}
          className={`rounded-md border px-3 py-2 ${
            page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"
          }`}
        >
          前へ
        </Link>
        <span className="text-gray-500">
          {page} / {totalPages}
        </span>
        <Link
          href={buildHref({ status, page: Math.min(totalPages, page + 1), pageSize })}
          className={`rounded-md border px-3 py-2 ${
            page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"
          }`}
        >
          次へ
        </Link>
      </nav>
    </main>
  );
}
