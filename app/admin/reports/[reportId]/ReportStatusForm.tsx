"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

const statusOptions = [
  { value: "pending", label: "未対応" },
  { value: "reviewing", label: "確認中" },
  { value: "resolved", label: "対応済み" },
  { value: "rejected", label: "却下" },
];

type ReportStatusFormProps = {
  reportId: string;
  initialStatus: string;
  initialAdminNote: string;
};

export default function ReportStatusForm({
  reportId,
  initialStatus,
  initialAdminNote,
}: ReportStatusFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [adminNote, setAdminNote] = useState(initialAdminNote);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (submitting) return;

    if (!confirm("この内容で通報の状態を更新しますか？")) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/admin/reports/${reportId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error || "更新に失敗しました");
        return;
      }

      setMessage("更新しました");
      router.refresh();
    } catch {
      setError("更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">対応</h2>
      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">ステータス</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={submitting}
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
          <span className="text-xs font-semibold text-gray-600">管理者メモ</span>
          <textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            maxLength={2000}
            rows={6}
            disabled={submitting}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            placeholder="確認内容や判断理由を記録します"
          />
        </label>

        <p className="text-xs text-gray-500">
          対応済みまたは却下にする場合は、管理者メモの入力が必要です。
        </p>

        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </section>
  );
}
