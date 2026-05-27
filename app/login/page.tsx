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

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
          <span className="text-xs text-[var(--color-ink-muted)]">または</span>
          <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
        </div>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/mypage" })}
          className="flex w-full items-center justify-center gap-2.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm font-medium text-[var(--color-ink-primary)] transition-colors hover:bg-[var(--color-bg-surface)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
          </svg>
          Google でログイン
        </button>

        <div className="mt-4 space-y-2 text-center text-sm text-[var(--color-ink-muted)]">
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
