"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserInfo {
  id: string;
  displayName: string;
  avatarUrl: string | null;
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
        fetch("/api/me/friends/requests").then((r) => r.json()).catch(() => ({ received: [], sent: [] })),
        fetch("/api/me/friends").then((r) => r.json()).catch(() => ({ friends: [] })),
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
    const res = await fetch(`/api/me/friends/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) fetchAll();
  };

  const handleReject = async (id: string) => {
    const res = await fetch(`/api/me/friends/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    if (res.ok) fetchAll();
  };

  const handleCancel = async (id: string) => {
    const res = await fetch(`/api/me/friends/requests/${id}`, { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  const handleUnfriend = async (userId: string) => {
    if (!confirm("友だちを解除しますか？")) return;
    const res = await fetch(`/api/me/friends/${userId}`, { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  const UserRow = ({ user, children }: { user: UserInfo; children: React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
      <Link href={`/users/${user.id}`} className="flex items-center gap-3 min-w-0 flex-1">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-800">
            {user.displayName.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{user.displayName}</p>
          {user.area && <p className="text-xs text-gray-400">📍 {user.area}</p>}
          {user.bio && <p className="truncate text-xs text-gray-500">{user.bio}</p>}
        </div>
      </Link>
      <div className="shrink-0 flex gap-2">{children}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/mypage" className="text-sm text-amber-600 hover:underline">
        ← マイページに戻る
      </Link>
      <h1 className="mt-4 mb-6 text-2xl font-bold text-gray-900">友だち</h1>

      {/* 受信した申請 */}
      {received.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            友だち申請
            <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">{received.length}</span>
          </h2>
          <div className="space-y-2">
            {received.map((req) => (
              <UserRow key={req.id} user={req.user}>
                <button
                  onClick={() => handleAccept(req.id)}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  承認
                </button>
                <button
                  onClick={() => handleReject(req.id)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
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
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          友だち一覧
          {friends.length > 0 && (
            <span className="ml-1.5 text-gray-400 font-normal">{friends.length}人</span>
          )}
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-gray-400">まだ友だちがいません</p>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <UserRow key={friend.id} user={friend}>
                <Link
                  href={`/mypage/messages/${friend.id}`}
                  className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200"
                >
                  メッセージ
                </Link>
                <button
                  onClick={() => handleUnfriend(friend.id)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50"
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
          <h2 className="mb-3 text-sm font-semibold text-gray-700">送信した申請</h2>
          <div className="space-y-2">
            {sent.map((req) => (
              <UserRow key={req.id} user={req.user}>
                <button
                  onClick={() => handleCancel(req.id)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  取消
                </button>
              </UserRow>
            ))}
          </div>
        </section>
      )}

      {/* ブロックリスト */}
      <div className="mt-8 border-t pt-4">
        <Link href="/mypage/blocks" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
          ブロックリストを管理
        </Link>
      </div>
    </div>
  );
}
