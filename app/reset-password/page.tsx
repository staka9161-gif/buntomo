"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("無効なリンクです。パスワードリセットを再度申請してください。");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (newPassword.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setDone(true);
      } else {
        setError(data?.error || "パスワードの変更に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm text-center">
          <div className="mb-4 text-4xl">&#x2705;</div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">
            パスワードを変更しました
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            新しいパスワードでログインしてください。
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-amber-600 px-6 py-2.5 font-semibold text-white hover:bg-amber-700"
          >
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm text-center">
          <div className="mb-4 text-4xl">&#x26A0;&#xFE0F;</div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">無効なリンク</h1>
          <p className="mb-6 text-sm text-gray-500">
            パスワードリセット用のリンクが無効か、有効期限が切れています。
          </p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-lg bg-amber-600 px-6 py-2.5 font-semibold text-white hover:bg-amber-700"
          >
            再度申請する
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          新しいパスワードを設定
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          新しいパスワードを入力してください
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              新しいパスワード
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border px-3 py-2 focus:border-amber-400 focus:outline-none"
              placeholder="8文字以上"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              新しいパスワード（確認）
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border px-3 py-2 focus:border-amber-400 focus:outline-none"
              placeholder="もう一度入力"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-600 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "変更中..." : "パスワードを変更する"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
