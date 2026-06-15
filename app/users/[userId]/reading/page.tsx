"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BookCard from "@/components/book/BookCard";
import { apiUrl } from "@/lib/api";

interface Reading {
  id: string;
  status: string;
  currentPage: number;
  completedAt: string | null;
  book: {
    id: string;
    title: string;
    author: string;
    totalPages: number;
    coverImageUrl: string | null;
  };
  readingCount: number;
  completedCount: number;
  eventCount: number;
}

export default function UserReadingPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl(`/api/users/${userId}/readings?status=reading`))
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "読み込みに失敗しました");
        setUser(data.user || null);
        setReadings(data.readings || []);
        setIsPrivate(!!data.private);
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={`/users/${userId}`} className="text-sm text-[var(--color-accent)] hover:underline">
        ← プロフィールに戻る
      </Link>
      <h1 className="mt-4 mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">
        {user?.name ? `${user.name}さんの読みかけの本` : "読みかけの本"}
      </h1>

      {error ? (
        <div className="card-base p-8 text-center text-sm text-[var(--color-ink-muted)]">{error}</div>
      ) : isPrivate ? (
        <div className="card-base p-8 text-center text-sm text-[var(--color-ink-muted)]">
          読書記録は公開されていません。
        </div>
      ) : readings.length === 0 ? (
        <div className="card-base p-8 text-center text-sm text-[var(--color-ink-muted)]">
          読みかけの本はまだありません。
        </div>
      ) : (
        <div className="space-y-4">
          {readings.map((reading) => (
            <BookCard
              key={reading.id}
              id={reading.book.id}
              title={reading.book.title}
              author={reading.book.author}
              coverImageUrl={reading.book.coverImageUrl}
              currentPage={reading.currentPage}
              totalPages={reading.book.totalPages}
              status={reading.status}
              completedAt={reading.completedAt}
              readingId={reading.id}
              readingCount={reading.readingCount}
              completedCount={reading.completedCount}
              eventCount={reading.eventCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
