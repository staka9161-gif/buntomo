"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { apiUrl } from "@/lib/api";

type AppealStatus = "pending" | "reviewing" | "resolved" | "rejected";

type Appeal = {
  id: string;
  status: AppealStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

const statusLabels: Record<AppealStatus, string> = {
  pending: "未対応",
  reviewing: "確認中",
  resolved: "確認済み",
  rejected: "却下",
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function SuspensionAppealForm() {
  const [message, setMessage] = useState("");
  const [latestAppeal, setLatestAppeal] = useState<Appeal | null>(null);
  const [hasOpenAppeal, setHasOpenAppeal] = useState(false);
  const [nextAllowedAt, setNextAllowedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAppeal() {
      setLoading(true);
      try {
        const res = await fetch(apiUrl("/api/me/suspension-appeal"), {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);

        if (!cancelled && res.ok) {
          setLatestAppeal(data.latestAppeal ?? null);
          setHasOpenAppeal(Boolean(data.hasOpenAppeal));
          setNextAllowedAt(data.nextAllowedAt ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAppeal();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => {
    const trimmed = message.trim();
    return trimmed.length >= 20 && trimmed.length <= 2000 && !hasOpenAppeal && !submitting;
  }, [hasOpenAppeal, message, submitting]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const res = await fetch(apiUrl("/api/me/suspension-appeal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "送信に失敗しました。時間をおいて再度お試しください。");
        if (data?.nextAllowedAt) setNextAllowedAt(data.nextAllowedAt);
        return;
      }

      setNotice("異議申し立てを受け付けました。運営の確認をお待ちください。");
      setMessage("");
      setLatestAppeal(data.appeal ?? null);
      setHasOpenAppeal(true);
      setNextAllowedAt(data.nextAllowedAt ?? null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">異議申し立て</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          利用停止について運営に確認を依頼できます。内容はできるだけ具体的に入力してください。
          送信しても、アカウント停止が自動で解除されることはありません。
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-gray-500">確認中です...</p>
        ) : latestAppeal ? (
          <div className="mt-4 rounded-md border bg-gray-50 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-700">直近の申し立て</span>
              <span className="rounded-full border bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">
                {statusLabels[latestAppeal.status] ?? latestAppeal.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              送信日時: {formatDateTime(latestAppeal.createdAt)}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-gray-700">{latestAppeal.message}</p>
          </div>
        ) : null}

        {hasOpenAppeal ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            未対応または確認中の申し立てがあります。追加送信は運営の確認後に行えます。
          </p>
        ) : null}

        {nextAllowedAt && !hasOpenAppeal ? (
          <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            次に送信できる目安: {formatDateTime(nextAllowedAt)}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">申し立て内容</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={hasOpenAppeal || submitting}
              minLength={20}
              maxLength={2000}
              rows={8}
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="停止に心当たりがない場合や、確認してほしい事情を入力してください。"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">{message.trim().length}/2000文字</p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "送信中..." : "異議申し立てを送信"}
            </button>
          </div>
        </form>

        {notice ? (
          <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
