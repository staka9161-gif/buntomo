"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BookCard from "@/components/book/BookCard";
import { apiUrl } from "@/lib/api";

interface Reading {
  id: string;
  workId: string | null;
  status: string;
  currentPage: number;
  completedAt: string | null;
  book: {
    id: string;
    title: string;
    author: string;
    totalPages: number;
    coverImageUrl: string | null;
    migratedWorkId: string | null;
  } | null;
  edition: {
    workId: string;
  } | null;
  readingCount: number;
  completedCount: number;
  eventCount: number;
}

type SelectedYear = "all" | "unset" | number;
type SortOrder = "desc" | "asc";

function getCompletedTime(value?: string | Date | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function getCompletedYear(value?: string | Date | null): number | null {
  const time = getCompletedTime(value);
  if (time === null) return null;
  return new Date(time).getFullYear();
}

export default function CompletedPage() {
  const { status } = useSession();
  const router = useRouter();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedYear, setSelectedYear] = useState<SelectedYear>("all");

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

  const handleCompletedAtChange = async (readingId: string, completedAt: string) => {
    const res = await fetch(apiUrl(`/api/me/readings/${readingId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      alert(error?.error || "読了日の更新に失敗しました");
      return false;
    }

    fetchReadings();
    return true;
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
  const yearCountMap = new Map<number, number>();
  let unsetCount = 0;
  for (const reading of validReadings) {
    const year = getCompletedYear(reading.completedAt);
    if (year === null) {
      unsetCount += 1;
    } else {
      yearCountMap.set(year, (yearCountMap.get(year) ?? 0) + 1);
    }
  }

  const yearChips = Array.from(yearCountMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, count]) => ({ year, count }));

  const filteredReadings = validReadings.filter((reading) => {
    if (selectedYear === "all") return true;
    const year = getCompletedYear(reading.completedAt);
    if (selectedYear === "unset") return year === null;
    return year === selectedYear;
  });

  const sortedReadings = [...filteredReadings].sort((a, b) => {
    const aTime = getCompletedTime(a.completedAt);
    const bTime = getCompletedTime(b.completedAt);
    if (aTime === null && bTime === null) return 0;
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
  });

  const emptyMessage =
    selectedYear === "all"
      ? "読了した本はまだありません"
      : selectedYear === "unset"
        ? "読了日未設定の本はありません"
        : "この年に読了した本はありません";

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
      active
        ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
        : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    }`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">読んだ本</h1>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSortOrder((current) => (current === "desc" ? "asc" : "desc"))}
          className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          読了日 {sortOrder === "desc" ? "新しい順 ▼" : "古い順 ▲"}
        </button>
      </div>

      <div className="mb-5 -mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-2">
          <button
            type="button"
            onClick={() => setSelectedYear("all")}
            className={chipClass(selectedYear === "all")}
          >
            全期間 {validReadings.length}冊
          </button>
          {yearChips.map(({ year, count }) => (
            <button
              key={year}
              type="button"
              onClick={() => setSelectedYear(year)}
              className={chipClass(selectedYear === year)}
            >
              {year} {count}冊
            </button>
          ))}
          {unsetCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedYear("unset")}
              className={chipClass(selectedYear === "unset")}
            >
              未設定 {unsetCount}冊
            </button>
          )}
        </div>
      </div>

      {sortedReadings.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-faint)] text-center py-8">{emptyMessage}</p>
      ) : (
        <div className="space-y-4">
          {sortedReadings.map((r) => {
            const workId = r.workId ?? r.edition?.workId ?? r.book.migratedWorkId;

            return (
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
                onCompletedAtChange={handleCompletedAtChange}
                onDelete={handleDelete}
                showCompletedDate
                impressionHref={workId ? `/works/${workId}` : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
