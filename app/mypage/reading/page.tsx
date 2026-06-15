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
  } | null;
  readingCount: number;
  completedCount: number;
  eventCount: number;
}

export default function ReadingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchReadings = async () => {
    try {
      const res = await fetch(apiUrl("/api/me/readings?status=reading"));
      const data = await res.json();
      setReadings(data.readings || []);
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchReadings();
  }, [status]);

  const handleUpdatePage = async (readingId: string, page: number) => {
    await fetch(apiUrl(`/api/me/readings/${readingId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPage: page }),
    });
    fetchReadings();
  };

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  const validReadings = readings.filter(
    (reading): reading is Reading & { book: NonNullable<Reading["book"]> } => !!reading.book?.id
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">読みかけの本</h1>

      {validReadings.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-faint)] text-center py-8">読みかけの本はありません</p>
      ) : (
        <div className="space-y-4">
          {validReadings.map((r) => (
            <BookCard
              key={r.id}
              id={r.book.id}
              title={r.book.title}
              author={r.book.author}
              coverImageUrl={r.book.coverImageUrl}
              currentPage={r.currentPage}
              totalPages={r.book.totalPages}
              status={r.status}
              readingId={r.id}
              readingCount={r.readingCount}
              completedCount={r.completedCount}
              eventCount={r.eventCount}
              onUpdatePage={handleUpdatePage}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
