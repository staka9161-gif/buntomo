"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type SuspensionControlsProps = {
  userId: string;
  isSuspended: boolean;
};

export function SuspensionControls({ userId, isSuspended }: SuspensionControlsProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const action = isSuspended ? "unsuspend" : "suspend";
  const label = isSuspended ? "停止解除" : "アカウント停止";

  async function handleSubmit() {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("理由を入力してください");
      return;
    }

    const confirmed = window.confirm(
      isSuspended
        ? "本当にアカウント停止を解除しますか？"
        : "本当にこのユーザーをアカウント停止にしますか？"
    );

    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${userId}/suspension`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: trimmedReason }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "操作に失敗しました");
        return;
      }

      setReason("");
      router.refresh();
    });
  }

  return (
    <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">アカウント停止</h2>
      <p className="mt-2 text-sm text-gray-600">
        {isSuspended
          ? "停止中のユーザーを利用可能な状態に戻します。"
          : "一時的に新規ログインをできない状態にします。"}
      </p>
      <label className="mt-4 block">
        <span className="text-xs font-semibold text-gray-600">理由（必須）</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          placeholder={isSuspended ? "対応完了のため" : "迷惑行為が確認されたため"}
          disabled={isPending}
        />
      </label>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className={`mt-4 rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
          isSuspended ? "bg-gray-900 hover:bg-gray-700" : "bg-red-700 hover:bg-red-800"
        }`}
      >
        {isPending ? "処理中..." : label}
      </button>
    </section>
  );
}
