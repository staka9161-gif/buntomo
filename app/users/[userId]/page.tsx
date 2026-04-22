"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import FriendRequestButton from "@/components/friends/FriendRequestButton";

interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  area: string | null;
  linkX: string | null;
  linkInstagram: string | null;
  linkWebsite: string | null;
  customLinks: { label: string; url: string }[];
  isPublic: boolean;
}

interface Reading {
  id: string;
  status: string;
  currentPage: number;
  book: {
    id: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
    totalPages: number;
  };
}

type FriendshipStatus = "none" | "pending-sent" | "pending-received" | "friends";

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const { data: session } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [hiddenFields, setHiddenFields] = useState({ bio: false, area: false, links: false, readings: false });
  const [loading, setLoading] = useState(true);

  const isMe = session?.user?.id === userId;

  const handleBlock = async () => {
    if (!confirm(`${user?.displayName || "このユーザー"} をブロックしますか？\n友だち関係も解除されます。`)) return;
    const res = await fetch(apiUrl(`/api/me/blocks/${userId}`), { method: "POST" });
    if (res.ok) {
      router.push("/mypage");
    } else {
      const err = await res.json().catch(() => null);
      alert(err?.error || "ブロックに失敗しました");
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch(apiUrl(`/api/users/${userId}`));
      if (!res.ok) return;
      const data = await res.json();
      setUser(data.user);
      setReadings(data.readings || []);
      setFriendshipStatus(data.friendshipStatus || "none");
      setFriendshipId(data.friendshipId || null);
      setHiddenFields(data.hiddenFields || { bio: false, area: false, links: false, readings: false });
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">ユーザーが見つかりませんでした</p>
      </div>
    );
  }

  const readingBooks = readings.filter((r) => r.status === "READING");
  const completedBooks = readings.filter((r) => r.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* プロフィールカード */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-start gap-5">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="h-20 w-20 shrink-0 rounded-full object-cover border-2 border-gray-200"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-amber-200 text-2xl font-bold text-amber-800">
              {user.displayName.charAt(0)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{user.displayName}</h1>
            {user.area && (
              <p className="mt-0.5 text-sm text-gray-500">📍 {user.area}</p>
            )}
            {user.bio && (
              <p className="mt-1 text-sm text-gray-600">{user.bio}</p>
            )}

            {/* SNSリンク */}
            <div className="mt-2 flex flex-wrap gap-3">
              {user.linkX && (
                <a href={`https://x.com/${user.linkX}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600">
                  X: @{user.linkX}
                </a>
              )}
              {user.linkInstagram && (
                <a href={`https://instagram.com/${user.linkInstagram}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600">
                  IG: @{user.linkInstagram}
                </a>
              )}
              {user.linkWebsite && (
                <a href={user.linkWebsite} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600">
                  🔗 Web
                </a>
              )}
              {user.customLinks.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600">
                  🔗 {link.label}
                </a>
              ))}
            </div>

            {/* 友だちボタン + メッセージ + ブロック */}
            {session && !isMe && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-3">
                  <FriendRequestButton
                    userId={userId}
                    initialStatus={friendshipStatus}
                    friendshipId={friendshipId}
                    onStatusChange={fetchData}
                  />
                  {friendshipStatus === "friends" && (
                    <Link
                      href={`/mypage/messages/${userId}`}
                      className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                    >
                      メッセージ
                    </Link>
                  )}
                </div>
                <button
                  onClick={handleBlock}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  このユーザーをブロック
                </button>
              </div>
            )}
            {isMe && (
              <div className="mt-4">
                <Link
                  href="/mypage/profile"
                  className="text-sm text-amber-600 hover:underline"
                >
                  プロフィールを編集
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 読書中 */}
      {!hiddenFields.readings && readingBooks.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">読書中の本</h2>
          <div className="space-y-2">
            {readingBooks.map((r) => (
              <Link
                key={r.id}
                href={`/books/${r.book.id}`}
                className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm hover:shadow-md transition"
              >
                {r.book.coverImageUrl ? (
                  <img src={r.book.coverImageUrl} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] text-gray-400">No Image</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{r.book.title}</p>
                  <p className="truncate text-xs text-gray-400">{r.book.author}</p>
                </div>
                {r.book.totalPages > 0 && (
                  <span className="shrink-0 text-xs text-gray-400">
                    {r.currentPage}/{r.book.totalPages}p
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 読了 */}
      {!hiddenFields.readings && completedBooks.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">読了した本</h2>
          <div className="space-y-2">
            {completedBooks.map((r) => (
              <Link
                key={r.id}
                href={`/books/${r.book.id}`}
                className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm hover:shadow-md transition"
              >
                {r.book.coverImageUrl ? (
                  <img src={r.book.coverImageUrl} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] text-gray-400">No Image</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{r.book.title}</p>
                  <p className="truncate text-xs text-gray-400">{r.book.author}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hiddenFields.readings && !isMe && (
        <div className="mt-6 rounded-xl border bg-white p-6 text-center text-sm text-gray-400">
          読書記録は友だちにのみ公開されています
        </div>
      )}
    </div>
  );
}
