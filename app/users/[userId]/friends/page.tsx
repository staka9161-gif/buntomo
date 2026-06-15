"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface Friend {
  id: string;
  handle: string | null;
  name: string;
  displayName?: string;
  image: string | null;
}

export default function UserFriendsPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl(`/api/users/${userId}/friends`))
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "読み込みに失敗しました");
        setUser(data.user || null);
        setFriends(data.friends || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/users/${userId}`} className="text-sm text-[var(--color-accent)] hover:underline">
        ← プロフィールに戻る
      </Link>
      <h1 className="mt-4 mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">
        {user?.name ? `${user.name}さんの友だち` : "友だち"}
      </h1>

      {error ? (
        <div className="card-base p-8 text-center text-sm text-[var(--color-ink-muted)]">{error}</div>
      ) : friends.length === 0 ? (
        <div className="card-base p-8 text-center text-sm text-[var(--color-ink-muted)]">
          友だちはまだいません。
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <Link
              key={friend.id}
              href={`/users/${friend.id}`}
              className="card-base flex items-center gap-3 p-4 transition hover:shadow-md"
            >
              {friend.image ? (
                <img
                  src={friend.image}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover shadow-[var(--shadow-cover)]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)]">
                  {(friend.displayName ?? friend.name).charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-serif text-base font-medium text-[var(--color-ink-primary)]">
                  {friend.displayName ?? friend.name}
                </p>
                {friend.handle && (
                  <p className="text-xs font-mono text-[var(--color-ink-faint)]">@{friend.handle}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
