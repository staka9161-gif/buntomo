"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";

const reportReasons = [
  { value: "inappropriate_profile", label: "不適切なプロフィール" },
  { value: "harassment", label: "迷惑行為" },
  { value: "impersonation", label: "なりすましの疑い" },
  { value: "other", label: "その他" },
];

type ReportUserButtonProps = {
  targetUserId: string;
};

export default function ReportUserButton({ targetUserId }: ReportUserButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reportReasons[0].value);
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!confirm("この内容で通報を送信しますか？")) return;

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(apiUrl("/api/reports"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "USER",
          targetId: targetUserId,
          reason,
          detail,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(data?.error || "通報の送信に失敗しました");
        return;
      }

      setMessage("通報を受け付けました");
      setDetail("");
      setOpen(false);
    } catch {
      setMessage("通報の送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-accent)]"
        >
          通報
        </button>
        {message && <p className="text-xs text-[var(--color-ink-muted)]">{message}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold text-[var(--color-ink-primary)]">
        プロフィールを通報
      </p>
      <label className="mt-2 block">
        <span className="text-xs text-[var(--color-ink-muted)]">理由</span>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          disabled={submitting}
        >
          {reportReasons.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-2 block">
        <span className="text-xs text-[var(--color-ink-muted)]">詳細（任意）</span>
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          maxLength={1000}
          rows={3}
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          placeholder="確認してほしい内容があれば入力してください"
          disabled={submitting}
        />
      </label>
      {message && <p className="mt-2 text-xs text-[var(--color-ink-muted)]">{message}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "送信中..." : "送信"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setMessage(null);
          }}
          disabled={submitting}
          className="rounded-md border px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-muted)]"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
