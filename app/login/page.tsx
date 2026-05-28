"use client";

import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowResend(false);
    setResendMsg("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result?.error) {
        router.push("/mypage");
      } else {
        setError("メールアドレスまたはパスワードが正しくありません");
        setShowResend(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (!email.trim() || resending) return;
    setResending(true);
    setResendMsg("");
    try {
      const res = await fetch(apiUrl("/api/auth/resend-verification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendMsg("確認メールを送信しました。受信箱をご確認ください。");
      } else {
        setResendMsg(data.error || "送信に失敗しました");
      }
    } catch {
      setResendMsg("通信エラーが発生しました");
    } finally {
      setResending(false);
    }
  }, [email, resending]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md card-base p-6 md:p-8">
        <h1 className="mb-4 text-center font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)] md:mb-6 md:text-2xl">ログイン</h1>

        {error && (
          <div className="mb-4 rounded bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">
            <p>{error}</p>
            {showResend && (
              <div className="mt-2 border-t border-[var(--color-border-subtle)] pt-2">
                <p className="text-xs text-[var(--color-ink-muted)]">
                  メールアドレスの確認がお済みでない場合:
                </p>
                {resendMsg ? (
                  <p className="mt-1 text-xs">{resendMsg}</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="mt-1 text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                  >
                    {resending ? "送信中..." : "確認メールを再送する"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
              placeholder="example@mail.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm text-[var(--color-ink-muted)]">
          <p>
            アカウントをお持ちでないですか？{" "}
            <Link href="/signup" className="text-[var(--color-accent)] hover:underline">
              新規登録
            </Link>
          </p>
          <p>
            <Link href="/forgot-password" className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] hover:underline">
              パスワードを忘れた方
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
