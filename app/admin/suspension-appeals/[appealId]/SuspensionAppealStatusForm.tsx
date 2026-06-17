"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

type Props = {
  appealId: string;
  initialStatus: string;
  initialAdminNote: string;
};

const statusOptions = [
  { value: "pending", label: "未対応" },
  { value: "reviewing", label: "確認中" },
  { value: "resolved", label: "確認済み" },
  { value: "rejected", label: "却下" },
];

export default function SuspensionAppealStatusForm({
  appealId,
  initialStatus,
  initialAdminNote,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [adminNote, setAdminNote] = useState(initialAdminNote);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(apiUrl(`/api/admin/suspension-appeals/${appealId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "更新に失敗しました");
        return;
      }

      setMessage("ステータスを更新しました。");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">対応ステータス</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">
        ここでは申し立ての確認状況だけを更新します。アカウント停止の解除はユーザー管理画面で行ってください。
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
          <span className="text-xs font-semibold text-gray-600">管理メモ</span>
          <textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            rows={7}
            maxLength={2000}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            placeholder="確認内容や判断理由を記録してください。確認済み・却下にする場合は必須です。"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? "更新中..." : "ステータスを更新"}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
