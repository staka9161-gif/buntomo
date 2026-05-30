"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface UserInfo {
  id: string;
  name: string;
  displayName?: string;
  image: string | null;
  bio: string | null;
  area: string | null;
}

interface FriendRequest {
  id: string;
  user: UserInfo;
  createdAt: string;
}

interface Friend extends UserInfo {
  friendshipId: string;
  since: string;
}

export default function FriendsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchAll = async () => {
    try {
      const [reqRes, friendRes] = await Promise.all([
        fetch(apiUrl("/api/me/friends/requests")).then((r) => r.json()).catch(() => ({ received: [], sent: [] })),
        fetch(apiUrl("/api/me/friends")).then((r) => r.json()).catch(() => ({ friends: [] })),
      ]);
      setReceived(reqRes.received || []);
      setSent(reqRes.sent || []);
      setFriends(friendRes.friends || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchAll();
  }, [status]);

  const handleAccept = async (id: string) => {
    const res = await fetch(apiUrl(`/api/me/friends/requests/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) fetchAll();
  };

  const handleReject = async (id: string) => {
    const res = await fetch(apiUrl(`/api/me/friends/requests/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    if (res.ok) fetchAll();
  };

  const handleCancel = async (id: string) => {
    const res = await fetch(apiUrl(`/api/me/friends/requests/${id}`), { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  const handleUnfriend = async (userId: string) => {
    if (!confirm("友だちを解除しますか？")) return;
    const res = await fetch(apiUrl(`/api/me/friends/${userId}`), { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  const UserRow = ({ user, children }: { user: UserInfo; children: React.ReactNode }) => (
    <div className="card-base flex items-center gap-3 p-4">
      <Link href={`/users/${user.id}`} className="flex items-center gap-3 min-w-0 flex-1">
        {user.image ? (
          <img src={user.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover shadow-[var(--shadow-cover)]" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)]">
            {user.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-medium text-[var(--color-ink-primary)]">{user.displayName ?? user.name}</p>
          {user.area && <p className="text-xs text-[var(--color-ink-muted)]">📍 {user.area}</p>}
          {user.bio && <p className="truncate text-xs text-[var(--color-ink-muted)]">{user.bio}</p>}
        </div>
      </Link>
      <div className="shrink-0 flex gap-2">{children}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/mypage" className="text-sm text-[var(--color-accent)] hover:underline">
        ← マイページに戻る
      </Link>
      <h1 className="mt-4 mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">友だち</h1>

      {/* IDで友だちを探す */}
      <HandleSearch onRequestSent={fetchAll} />

      {/* 受信した申請 */}
      {received.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-serif text-sm font-medium text-[var(--color-ink-primary)]">
            友だち申請
            <span className="ml-1.5 rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs text-[var(--color-accent)]">{received.length}</span>
          </h2>
          <div className="space-y-2">
            {received.map((req) => (
              <UserRow key={req.id} user={req.user}>
                <button
                  onClick={() => handleAccept(req.id)}
                  className="btn-primary-sm"
                >
                  承認
                </button>
                <button
                  onClick={() => handleReject(req.id)}
                  className="btn-secondary-sm"
                >
                  拒否
                </button>
              </UserRow>
            ))}
          </div>
        </section>
      )}

      {/* 友だちリスト */}
      <section className="mb-8">
        <h2 className="mb-3 font-serif text-sm font-medium text-[var(--color-ink-primary)]">
          友だち一覧
          {friends.length > 0 && (
            <span className="ml-1.5 text-[var(--color-ink-faint)] font-normal">{friends.length}人</span>
          )}
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-faint)]">まだ友だちがいません</p>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <UserRow key={friend.id} user={friend}>
                <Link
                  href={`/mypage/messages/${friend.id}`}
                  className="btn-primary-sm"
                >
                  メッセージ
                </Link>
                <button
                  onClick={() => handleUnfriend(friend.id)}
                  className="btn-secondary-sm"
                >
                  解除
                </button>
              </UserRow>
            ))}
          </div>
        )}
      </section>

      {/* 送信した申請 */}
      {sent.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-sm font-medium text-[var(--color-ink-primary)]">送信した申請</h2>
          <div className="space-y-2">
            {sent.map((req) => (
              <UserRow key={req.id} user={req.user}>
                <button
                  onClick={() => handleCancel(req.id)}
                  className="btn-secondary-sm"
                >
                  取消
                </button>
              </UserRow>
            ))}
          </div>
        </section>
      )}

      {/* ブロックリスト */}
      <div className="mt-8 border-t border-[var(--color-border-subtle)] pt-4">
        <Link href="/mypage/blocks" className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink-primary)] hover:underline">
          ブロックリストを管理
        </Link>
      </div>
    </div>
  );
}

interface SearchResult {
  id: string;
  handle: string;
  displayName: string;
  image: string | null;
}

function HandleSearch({ onRequestSent }: { onRequestSent: () => void }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ found: false } | { found: true; user: SearchResult; relation: string } | null>(null);
  const [sending, setSending] = useState(false);

  const doSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl(`/api/users/search-by-handle?handle=${encodeURIComponent(query.trim())}`));
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ found: false });
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (userId: string) => {
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/me/friends/requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setResult((prev) =>
          prev && "user" in prev && prev.found
            ? { ...prev, relation: "pending-sent" }
            : prev
        );
        onRequestSent();
      }
    } finally {
      setSending(false);
    }
  };

  const relationButton = (relation: string, userId: string) => {
    switch (relation) {
      case "self":
        return <span className="text-xs text-[var(--color-ink-faint)]">これはあなたです</span>;
      case "friends":
        return <span className="text-xs text-[var(--color-status-success)]">友だち</span>;
      case "pending-sent":
        return <span className="text-xs text-[var(--color-ink-muted)]">申請中</span>;
      case "pending-received":
        return <span className="text-xs text-amber-600">相手から申請が届いています</span>;
      default:
        return (
          <button
            onClick={() => sendRequest(userId)}
            disabled={sending}
            className="btn-primary-sm disabled:opacity-50"
          >
            {sending ? "送信中..." : "友だち申請する"}
          </button>
        );
    }
  };

  return (
    <section className="mb-8 card-base p-5">
      <h2 className="mb-3 font-serif text-sm font-medium text-[var(--color-ink-primary)]">IDで友だちを探す</h2>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
          onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
          placeholder="my_id"
          className="flex-1 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm font-mono focus:border-[var(--color-accent)] focus:outline-none transition-colors"
        />
        <button
          onClick={doSearch}
          disabled={searching || !query.trim()}
          className="btn-dark disabled:opacity-50"
        >
          {searching ? "検索中..." : "検索"}
        </button>
      </div>

      {result && !result.found && (
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">そのIDのユーザーは見つかりません</p>
      )}

      {result && result.found && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--color-border-faint)] bg-[var(--color-bg-base)] p-3">
          <Link href={`/users/${result.user.id}`} className="flex items-center gap-3 min-w-0 flex-1">
            {result.user.image ? (
              <img src={result.user.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)]">
                {result.user.displayName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-serif text-sm font-medium text-[var(--color-ink-primary)]">{result.user.displayName}</p>
              <p className="text-xs font-mono text-[var(--color-ink-faint)]">@{result.user.handle}</p>
            </div>
          </Link>
          <div className="shrink-0">{relationButton(result.relation, result.user.id)}</div>
        </div>
      )}
    </section>
  );
}
