"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

export default function VerifyEmailPendingPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    setMessage("");

    try {
      const res = await fetch(apiUrl("/api/auth/resend-verification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md card-base p-6 md:p-8 text-center">
        <div className="mb-4 text-4xl">✉️</div>
        <h1 className="mb-3 font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)]">
          確認メールを送信しました
        </h1>
        <p className="mb-1 text-sm text-[var(--color-ink-muted)]">
          以下のメールアドレスに確認メールを送信しました。
        </p>
        {email && (
          <p className="mb-4 text-sm font-medium text-[var(--color-ink-primary)]">{email}</p>
        )}
        <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
          メール内のリンクをクリックして、登録を完了してください。
          <br />
          リンクの有効期限は24時間です。
        </p>

        {message && (
          <div className="mb-4 rounded bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">
            {message}
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-[var(--color-accent)] hover:underline disabled:opacity-50"
        >
          {resending ? "送信中..." : "確認メールを再送する"}
        </button>

        <p className="mt-6 text-xs text-[var(--color-ink-faint)]">
          既に確認済みの場合は{" "}
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            ログイン
          </Link>
          {" "}してください。
        </p>
      </div>
    </div>
  );
}
