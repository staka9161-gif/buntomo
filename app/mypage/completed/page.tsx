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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">読んだ本</h1>

      {readings.length === 0 ? (
        <p className="text-gray-500">読了した本はまだありません</p>
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
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
