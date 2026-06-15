"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

export default function CompletedPage() {
  const { status } = useSession();
  const router = useRouter();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchReadings = () => {
    fetch(apiUrl("/api/me/readings?status=completed"))
      .then((r) => r.json())
      .then((data) => {
        setReadings(data.readings || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (status === "authenticated") fetchReadings();
  }, [status]);

  const handleStatusChange = async (readingId: string, newStatus: string) => {
    await fetch(apiUrl(`/api/me/readings/${readingId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchReadings();
  };

  const handleDelete = async (readingId: string) => {
    const res = await fetch(apiUrl(`/api/me/readings/${readingId}`), { method: "DELETE" });
    if (res.ok) {
      fetchReadings();
    }
  };

  const handleCompletedDateChange = async (readingId: string, completedAt: string) => {
    const res = await fetch(apiUrl(`/api/me/readings/${readingId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || "読了日の更新に失敗しました");
      throw new Error(data?.error || "Failed to update completed date");
    }
    fetchReadings();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">読んだ本</h1>

      {readings.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-faint)] text-center py-8">読了した本はまだありません</p>
      ) : (
        <div className="space-y-4">
          {readings.map((r) => (
            <BookCard
              key={r.id}
              id={r.book.id}
              title={r.book.title}
              author={r.book.author}
              coverImageUrl={r.book.coverImageUrl}
              totalPages={r.book.totalPages}
              status={r.status}
              completedAt={r.completedAt}
              readingId={r.id}
              readingCount={r.readingCount}
              completedCount={r.completedCount}
              eventCount={r.eventCount}
              onCompletedDateChange={handleCompletedDateChange}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
