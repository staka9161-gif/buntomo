"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface Conversation {
  user: { id: string; displayName: string; avatarUrl: string | null };
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
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/mypage" className="text-sm text-amber-600 hover:underline">
        ← マイページに戻る
      </Link>
      <h1 className="mt-4 mb-6 text-2xl font-bold text-gray-900">メッセージ</h1>

      {conversations.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-gray-500">メッセージはまだありません</p>
          <p className="mt-2 text-sm text-gray-400">
            友だちのプロフィールからメッセージを送ってみましょう
          </p>
          <Link
            href="/mypage/friends"
            className="mt-4 inline-block rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white hover:bg-amber-700"
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
              className="flex items-center gap-3 rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              {conv.user.avatarUrl ? (
                <img
                  src={conv.user.avatarUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-200 text-lg font-bold text-amber-800">
                  {conv.user.displayName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 truncate">{conv.user.displayName}</p>
                  <span className="shrink-0 text-xs text-gray-400">{formatRelativeTime(conv.lastMessageAt)}</span>
                </div>
                <p className="mt-0.5 truncate text-sm text-gray-500">
                  {conv.isMe && <span className="text-gray-400">自分: </span>}
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
