"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import FriendRequestButton from "@/components/friends/FriendRequestButton";
import { FaXTwitter, FaInstagram } from "react-icons/fa6";

interface UserProfile {
  id: string;
  handle?: string | null;
  name: string;
  displayName?: string;
  image: string | null;
  bio: string | null;
  area: string | null;
  linkX: string | null;
  linkInstagram: string | null;
  linkWebsite: string | null;
  linkWebsiteLabel: string | null;
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
  const [stats, setStats] = useState({ readingCount: 0, completedCount: 0, friendCount: 0 });
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [hiddenFields, setHiddenFields] = useState({ bio: false, area: false, links: false, readings: false });
  const [loading, setLoading] = useState(true);

  const isMe = session?.user?.id === userId;

  const handleBlock = async () => {
    if (!confirm(`${user?.name || "このユーザー"} をブロックしますか？\n友だち関係も解除されます。`)) return;
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
      setStats(data.stats || { readingCount: 0, completedCount: 0, friendCount: 0 });
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
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-muted)]">ユーザーが見つかりませんでした</p>
      </div>
    );
  }

  const readingBooks = readings.filter((r) => r.status === "READING");
  const completedBooks = readings.filter((r) => r.status === "COMPLETED");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* プロフィールカード */}
      <div className="card-base p-6">
        <div className="flex items-start gap-5">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="h-20 w-20 shrink-0 rounded-full object-cover shadow-[var(--shadow-cover)]"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-2xl font-bold text-[var(--color-accent)]">
              {user.name.charAt(0)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">{user.displayName ?? user.name}</h1>
            {user.handle && (
              <p className="mt-0.5 text-sm font-mono text-[var(--color-ink-muted)]">@{user.handle}</p>
            )}
            {user.area && (
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">📍 {user.area}</p>
            )}
            {user.bio && (
              <p className="mt-1 text-sm text-[var(--color-ink-primary)] leading-relaxed">{user.bio}</p>
            )}

            {/* SNSリンク */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {user.linkX && (
                <a href={`https://x.com/${user.linkX}`} target="_blank" rel="noopener noreferrer" className="text-[#000] hover:opacity-70 transition-opacity" aria-label={`X (@${user.linkX})`} title={`@${user.linkX}`}>
                  <FaXTwitter size={18} />
                </a>
              )}
              {user.linkInstagram && (
                <a href={`https://instagram.com/${user.linkInstagram}`} target="_blank" rel="noopener noreferrer" className="text-[#E4405F] hover:opacity-70 transition-opacity" aria-label={`Instagram (@${user.linkInstagram})`} title={`@${user.linkInstagram}`}>
                  <FaInstagram size={20} />
                </a>
              )}
              {user.linkWebsite && (
                <a href={user.linkWebsite} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-accent)] hover:underline">
                  🔗 {user.linkWebsiteLabel || "Web"}
                </a>
              )}
              {user.customLinks.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-accent)] hover:underline">
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
                      className="btn-secondary-sm"
                    >
                      メッセージ
                    </Link>
                  )}
                </div>
                <button
                  onClick={handleBlock}
                  className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-accent)]"
                >
                  このユーザーをブロック
                </button>
              </div>
            )}
            {isMe && (
              <div className="mt-4">
                <Link
                  href="/mypage/profile"
                  className="text-sm text-[var(--color-accent)] hover:underline"
                >
                  プロフィールを編集
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 数字グリッド */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="card-base p-4 text-center md:p-5">
          <p className="font-serif text-2xl font-medium leading-none text-[var(--color-accent)] md:text-3xl">
            {hiddenFields.readings && !isMe ? "—" : stats.readingCount}
          </p>
          <p className="mt-2 text-[11px] tracking-[0.05em] text-[var(--color-ink-muted)] md:text-xs">読みかけの本</p>
        </div>
        <div className="card-base p-4 text-center md:p-5">
          <p className="font-serif text-2xl font-medium leading-none text-[var(--color-accent)] md:text-3xl">
            {hiddenFields.readings && !isMe ? "—" : stats.completedCount}
          </p>
          <p className="mt-2 text-[11px] tracking-[0.05em] text-[var(--color-ink-muted)] md:text-xs">読了した本</p>
        </div>
        <div className="card-base p-4 text-center md:p-5">
          <p className="font-serif text-2xl font-medium leading-none text-[var(--color-accent)] md:text-3xl">{stats.friendCount}</p>
          <p className="mt-2 text-[11px] tracking-[0.05em] text-[var(--color-ink-muted)] md:text-xs">友だち</p>
        </div>
      </div>

      {/* 読書中 */}
      {!hiddenFields.readings && readingBooks.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-serif text-base font-medium text-[var(--color-ink-primary)]">読書中の本</h2>
          <div className="space-y-2">
            {readingBooks.map((r) => (
              <Link
                key={r.id}
                href={`/books/${r.book.id}`}
                className="card-base flex items-center gap-3 p-3 transition hover:shadow-md"
              >
                {r.book.coverImageUrl ? (
                  <img src={r.book.coverImageUrl} alt="" className="h-12 w-8 shrink-0 rounded object-cover" onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = "none"; el.nextElementSibling?.classList.remove("hidden"); }} />
                ) : null}
                <div className={`flex h-12 w-8 shrink-0 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-[9px] text-[var(--color-ink-faint)] ${r.book.coverImageUrl ? "hidden" : ""}`}>No Image</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-sm font-medium text-[var(--color-ink-primary)]">{r.book.title}</p>
                  <p className="truncate text-xs text-[var(--color-ink-muted)]">{r.book.author}</p>
                </div>
                {r.book.totalPages > 0 && (
                  <span className="shrink-0 text-xs font-mono text-[var(--color-ink-faint)]">
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
          <h2 className="mb-3 font-serif text-base font-medium text-[var(--color-ink-primary)]">読了した本</h2>
          <div className="space-y-2">
            {completedBooks.map((r) => (
              <Link
                key={r.id}
                href={`/books/${r.book.id}`}
                className="card-base flex items-center gap-3 p-3 transition hover:shadow-md"
              >
                {r.book.coverImageUrl ? (
                  <img src={r.book.coverImageUrl} alt="" className="h-12 w-8 shrink-0 rounded object-cover" onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = "none"; el.nextElementSibling?.classList.remove("hidden"); }} />
                ) : null}
                <div className={`flex h-12 w-8 shrink-0 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-[9px] text-[var(--color-ink-faint)] ${r.book.coverImageUrl ? "hidden" : ""}`}>No Image</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-sm font-medium text-[var(--color-ink-primary)]">{r.book.title}</p>
                  <p className="truncate text-xs text-[var(--color-ink-muted)]">{r.book.author}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hiddenFields.readings && !isMe && (
        <div className="mt-6 card-base p-6 text-center text-sm text-[var(--color-ink-faint)] italic">
          読書記録は友だちにのみ公開されています
        </div>
      )}
    </div>
  );
}
