"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

export default function NotificationSettingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState({
    emailNotifDM: true,
    emailNotifFriendRequest: true,
    emailNotifFriendAccepted: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(apiUrl("/api/me/notification-settings"))
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(apiUrl("/api/me/notification-settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage("保存しました");
      } else {
        setMessage("保存に失敗しました");
      }
    } catch {
      setMessage("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <Link href="/mypage/notifications" className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] hover:underline">
          ← 通知に戻る
        </Link>
        <h1 className="mt-2 font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)]">通知設定</h1>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">メール通知の ON/OFF を設定できます。</p>
      </div>

      <div className="card-base p-6 space-y-5">
        <label className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink-primary)]">ダイレクトメッセージ</p>
            <p className="text-xs text-[var(--color-ink-muted)]">新しい DM が届いたときにメール通知</p>
          </div>
          <input
            type="checkbox"
            checked={settings.emailNotifDM}
            onChange={(e) => setSettings({ ...settings, emailNotifDM: e.target.checked })}
            className="h-5 w-5 accent-[var(--color-accent)]"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink-primary)]">友だち申請</p>
            <p className="text-xs text-[var(--color-ink-muted)]">友だち申請を受け取ったときにメール通知</p>
          </div>
          <input
            type="checkbox"
            checked={settings.emailNotifFriendRequest}
            onChange={(e) => setSettings({ ...settings, emailNotifFriendRequest: e.target.checked })}
            className="h-5 w-5 accent-[var(--color-accent)]"
          />
        </label>

        <label className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink-primary)]">友だち申請の承認</p>
            <p className="text-xs text-[var(--color-ink-muted)]">友だち申請が承認されたときにメール通知</p>
          </div>
          <input
            type="checkbox"
            checked={settings.emailNotifFriendAccepted}
            onChange={(e) => setSettings({ ...settings, emailNotifFriendAccepted: e.target.checked })}
            className="h-5 w-5 accent-[var(--color-accent)]"
          />
        </label>
      </div>

      {message && (
        <p className="mt-3 text-center text-sm text-[var(--color-accent)]">{message}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary mt-4 w-full disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存する"}
      </button>
    </div>
  );
}
