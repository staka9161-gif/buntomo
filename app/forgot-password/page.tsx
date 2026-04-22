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
        <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm text-center">
          {resetUrl ? (
            <>
              <div className="mb-4 text-4xl">🔗</div>
              <h1 className="mb-2 text-xl font-bold text-gray-900">リセットリンク</h1>
              <p className="mb-4 text-sm text-gray-500">
                SMTP未設定のため、リンクを直接表示しています。
              </p>
              <a
                href={resetUrl}
                className="inline-block rounded-lg bg-amber-600 px-6 py-2.5 font-semibold text-white hover:bg-amber-700"
              >
                パスワードを再設定する
              </a>
              <p className="mt-4 text-xs text-gray-400">
                有効期限は1時間です。
              </p>
            </>
          ) : (
            <>
              <div className="mb-4 text-4xl">📧</div>
              <h1 className="mb-2 text-xl font-bold text-gray-900">メールを送信しました</h1>
              <p className="mb-2 text-sm text-gray-600">
                <strong>{email}</strong> 宛にパスワード再設定用のリンクを送信しました。
              </p>
              <p className="mb-6 text-sm text-gray-500">
                メールが届かない場合は、迷惑メールフォルダを確認するか、
                登録時のメールアドレスが正しいかご確認ください。
              </p>
              <p className="text-sm text-gray-400">
                リンクの有効期限は1時間です。
              </p>
            </>
          )}
          <div className="mt-6">
            <Link href="/login" className="text-amber-600 hover:underline text-sm">
              ログインに戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          パスワードをお忘れですか？
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2 focus:border-amber-400 focus:outline-none"
              placeholder="example@mail.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-600 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "送信中..." : "再設定メールを送信"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/login" className="text-amber-600 hover:underline">
            ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
