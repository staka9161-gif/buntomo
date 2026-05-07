"use client";

import { useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        if (data?.resetUrl) {
          setResetUrl(data.resetUrl);
        }
        setSent(true);
      } else {
        setError(data?.error || "送信に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md card-base p-6 text-center md:p-8">
          {resetUrl ? (
            <>
              <div className="mb-4 text-4xl">🔗</div>
              <h1 className="mb-2 font-serif text-xl font-medium text-[var(--color-ink-primary)]">リセットリンク</h1>
              <p className="mb-4 text-sm text-[var(--color-ink-muted)]">
                SMTP未設定のため、リンクを直接表示しています。
              </p>
              <a
                href={resetUrl}
                className="inline-block btn-primary"
              >
                パスワードを再設定する
              </a>
              <p className="mt-4 text-xs text-[var(--color-ink-faint)]">
                有効期限は1時間です。
              </p>
            </>
          ) : (
            <>
              <div className="mb-4 text-4xl">📧</div>
              <h1 className="mb-2 font-serif text-xl font-medium text-[var(--color-ink-primary)]">メールを送信しました</h1>
              <p className="mb-2 text-sm text-[var(--color-ink-primary)]">
                <strong>{email}</strong> 宛にパスワード再設定用のリンクを送信しました。
              </p>
              <p className="mb-6 text-sm text-[var(--color-ink-muted)]">
                メールが届かない場合は、迷惑メールフォルダを確認するか、
                登録時のメールアドレスが正しいかご確認ください。
              </p>
              <p className="text-xs text-[var(--color-ink-faint)]">
                リンクの有効期限は1時間です。
              </p>
            </>
          )}
          <div className="mt-6">
            <Link href="/login" className="text-sm text-[var(--color-accent)] hover:underline">
              ログインに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md card-base p-6 md:p-8">
        <h1 className="mb-2 text-center font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)] md:text-2xl">
          パスワードをお忘れですか？
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--color-ink-muted)]">
          登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
        </p>

        {error && (
          <div className="mb-4 rounded bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
              placeholder="example@mail.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "送信中..." : "再設定メールを送信"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--color-ink-muted)]">
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
