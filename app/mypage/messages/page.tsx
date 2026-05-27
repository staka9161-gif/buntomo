"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface Conversation {
  user: { id: string; name: string; image: string | null };
  lastMessage: string;
  lastMessageAt: string;
  isMe: boolean;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

export default function MessagesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(apiUrl("/api/me/dms"))
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/mypage" className="text-sm text-[var(--color-accent)] hover:underline">
        ← マイページに戻る
      </Link>
      <h1 className="mt-4 mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">メッセージ</h1>

      {conversations.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-[var(--color-ink-muted)]">メッセージはまだありません</p>
          <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
            友だちのプロフィールからメッセージを送ってみましょう
          </p>
          <Link
            href="/mypage/friends"
            className="mt-4 inline-block btn-primary"
          >
            友だちリスト
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {conversations.map((conv) => (
            <Link
              key={conv.user.id}
              href={`/mypage/messages/${conv.user.id}`}
              className="card-base flex items-center gap-3 p-3 transition hover:shadow-md"
            >
              {conv.user.image ? (
                <img
                  src={conv.user.image}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover shadow-[var(--shadow-cover)]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-lg font-bold text-[var(--color-accent)]">
                  {conv.user.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-serif text-sm font-medium text-[var(--color-ink-primary)] truncate">{conv.user.name}</p>
                  <span className="shrink-0 text-[10px] font-mono text-[var(--color-ink-faint)]">{formatRelativeTime(conv.lastMessageAt)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                  {conv.isMe && <span className="text-[var(--color-ink-faint)]">自分: </span>}
                  {conv.lastMessage}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
