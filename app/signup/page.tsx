"use client";

import { useState, useEffect, useRef } from "react";
import { apiUrl } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [nameCollision, setNameCollision] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!name.trim()) { setNameCollision(null); return; }
    debounceRef.current = setTimeout(() => {
      fetch(apiUrl(`/api/users/check-name?name=${encodeURIComponent(name.trim())}`))
        .then((r) => r.json())
        .then((data) => setNameCollision(data.count ?? 0))
        .catch(() => setNameCollision(null));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登録に失敗しました");
        return;
      }

      // メール確認ページへ遷移
      router.push(`/verify-email/pending?email=${encodeURIComponent(email)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md card-base p-6 md:p-8">
        <h1 className="mb-4 text-center font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)] md:mb-6 md:text-2xl">新規登録</h1>

        {error && (
          <div className="mb-4 rounded bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">ユーザーネーム</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
              placeholder="ぶんちゃん"
            />
            {nameCollision != null && nameCollision > 0 ? (
              <p className="mt-1 text-xs text-amber-600">
                ※同じユーザーネームのユーザーがいるため、番号「#{nameCollision + 1}」が自動付与されます。
              </p>
            ) : (
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                ※他のユーザーに公開されます。本名は使わないことを推奨。後から変更できます。
              </p>
            )}
          </div>
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
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-ink-primary)]">
              パスワード（8文字以上）
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none transition-colors"
            />
          </div>
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] p-4 text-sm">
            <p className="font-medium text-[var(--color-ink-primary)] mb-2">ブントモを使う前に</p>
            <ul className="space-y-1 text-xs text-[var(--color-ink-muted)] list-disc list-inside">
              <li>お互いを尊重しあう場所です。誹謗中傷や嫌がらせはご遠慮ください</li>
              <li>13歳以上の方が利用できます</li>
              <li>退会後30日以内はログインにより復元できます。30日を過ぎると、アカウント情報等の削除処理が行われます</li>
              <li>くわしくは <Link href="/terms" className="text-[var(--color-accent)] underline" target="_blank">利用規約</Link> と <Link href="/privacy" className="text-[var(--color-accent)] underline" target="_blank">プライバシーポリシー</Link> をご覧ください</li>
            </ul>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-primary)]">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
            <span>上記に同意します</span>
          </label>

          <button
            type="submit"
            disabled={loading || !agreed}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "登録中..." : "登録する"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">
          既にアカウントをお持ちですか？{" "}
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
