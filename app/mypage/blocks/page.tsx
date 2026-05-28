"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface BlockedUser {
  id: string;
  user: { id: string; name: string; displayName?: string; image: string | null };
  createdAt: string;
}

export default function BlockListPage() {
  const { status } = useSession();
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchBlocks = async () => {
    try {
      const res = await fetch(apiUrl("/api/me/blocks"));
      const data = await res.json();
      setBlocks(data.blocks || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchBlocks();
  }, [status]);

  const handleUnblock = async (userId: string) => {
    if (!confirm("ブロックを解除しますか？")) return;
    const res = await fetch(apiUrl(`/api/me/blocks/${userId}`), { method: "DELETE" });
    if (res.ok) fetchBlocks();
  };

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
      <h1 className="mt-4 mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">ブロックリスト</h1>

      {blocks.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-faint)] text-center py-8">ブロックしているユーザーはいません</p>
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => (
            <div key={b.id} className="card-base flex items-center gap-3 p-4">
              {b.user.image ? (
                <img src={b.user.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover shadow-[var(--shadow-cover)]" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)]">
                  {b.user.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-serif text-sm font-medium text-[var(--color-ink-primary)] truncate">{b.user.displayName ?? b.user.name}</p>
              </div>
              <button
                onClick={() => handleUnblock(b.user.id)}
                className="shrink-0 btn-secondary-sm"
              >
                解除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
