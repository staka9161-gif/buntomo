"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");

  const handleResend = async () => {
    if (!email.trim() || resending) return;
    setResending(true);
    setMessage("");

    try {
      const res = await fetch(apiUrl("/api/auth/resend-verification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("確認メールを再送しました。受信箱をご確認ください。");
      } else {
        setMessage(data.error || "再送に失敗しました");
      }
    } catch {
      setMessage("通信エラーが発生しました");
    } finally {
      setResending(false);
    }
  };

  if (status === "success" || status === "already_verified") {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md card-base p-6 md:p-8 text-center">
          <div className="mb-4 text-4xl">✅</div>
          <h1 className="mb-3 font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)]">
            {status === "already_verified" ? "既に確認済みです" : "メールアドレスの確認が完了しました"}
          </h1>
          <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
            ログインしてご利用ください。
          </p>
          <Link href="/login" className="btn-primary inline-block">
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  // expired or invalid
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md card-base p-6 md:p-8 text-center">
        <div className="mb-4 text-4xl">{status === "expired" ? "⏰" : "❌"}</div>
        <h1 className="mb-3 font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)]">
          {status === "expired"
            ? "リンクの有効期限が切れています"
            : "無効なリンクです"}
        </h1>
        <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
          {status === "expired"
            ? "確認メールを再送して、新しいリンクをお試しください。"
            : "このリンクは無効か、既に使用されています。確認メールを再送してください。"}
        </p>

        {message && (
          <div className="mb-4 rounded bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">
            {message}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="登録したメールアドレス"
            className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          />
          <button
            onClick={handleResend}
            disabled={resending || !email.trim()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {resending ? "送信中..." : "確認メールを再送する"}
          </button>
        </div>

        <p className="mt-6 text-xs text-[var(--color-ink-faint)]">
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            ログインページに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
