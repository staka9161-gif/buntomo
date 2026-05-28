"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface FriendRequest {
  id: string;
  user: { id: string; name: string; displayName?: string; image: string | null };
  createdAt: string;
}

interface Conversation {
  user: { id: string; name: string; displayName?: string; image: string | null };
  lastMessage: string;
  lastMessageAt: string;
  isMe: boolean;
}

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch(apiUrl("/api/me/friends/requests")).then((r) => r.json()).catch(() => ({ received: [] })),
      fetch(apiUrl("/api/me/dms")).then((r) => r.json()).catch(() => ({ conversations: [] })),
    ]).then(([reqData, dmData]) => {
      setRequests(reqData.received || []);
      setConversations(dmData.conversations || []);
      setLoading(false);
    });
  }, [status]);

  const handleRequest = async (id: string, action: "accept" | "reject") => {
    await fetch(apiUrl(`/api/me/friends/requests/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  const hasNotifications = requests.length > 0 || conversations.length > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)]">通知</h1>
        <Link href="/mypage/profile#notifications" className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] hover:underline">
          通知設定
        </Link>
      </div>

      {!hasNotifications && (
        <div className="card-base p-8 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">現在新しい通知はありません</p>
        </div>
      )}

      {requests.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-serif text-base font-medium text-[var(--color-ink-primary)]">
            友だち申請 ({requests.length})
          </h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="card-base flex items-center gap-3 p-4">
                <Link href={`/users/${r.user.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  {r.user.image ? (
                    <img src={r.user.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)]">
                      {r.user.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-serif text-sm font-medium text-[var(--color-ink-primary)]">
                      {r.user.displayName ?? r.user.name}
                    </p>
                    <p className="text-xs text-[var(--color-ink-faint)]">友だち申請</p>
                  </div>
                </Link>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => handleRequest(r.id, "accept")} className="btn-primary-sm">承認</button>
                  <button onClick={() => handleRequest(r.id, "reject")} className="btn-secondary-sm">拒否</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {conversations.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-base font-medium text-[var(--color-ink-primary)]">
            メッセージ
          </h2>
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Link
                key={conv.user.id}
                href={`/mypage/messages/${conv.user.id}`}
                className="card-base flex items-center gap-3 p-4 transition hover:shadow-md"
              >
                {conv.user.image ? (
                  <img src={conv.user.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)]">
                    {conv.user.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-sm font-medium text-[var(--color-ink-primary)]">
                    {conv.user.displayName ?? conv.user.name}
                  </p>
                  <p className="truncate text-xs text-[var(--color-ink-muted)]">
                    {conv.isMe && <span className="text-[var(--color-ink-faint)]">自分: </span>}
                    {conv.lastMessage}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
