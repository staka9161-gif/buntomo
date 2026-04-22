"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

interface BlockedUser {
  id: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
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
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/mypage" className="text-sm text-amber-600 hover:underline">
        ← マイページに戻る
      </Link>
      <h1 className="mt-4 mb-6 text-2xl font-bold text-gray-900">ブロックリスト</h1>

      {blocks.length === 0 ? (
        <p className="text-sm text-gray-400">ブロックしているユーザーはいません</p>
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
              {b.user.avatarUrl ? (
                <img src={b.user.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-500">
                  {b.user.displayName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{b.user.displayName}</p>
              </div>
              <button
                onClick={() => handleUnblock(b.user.id)}
                className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:text-amber-600 hover:border-amber-300"
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
