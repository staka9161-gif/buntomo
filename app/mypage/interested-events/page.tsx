"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api";
import ReadingEventInterestButton from "@/components/events/ReadingEventInterestButton";

type EventItem = {
  id: string;
  title: string;
  eventDate: string;
  prefecture: string;
  location: string;
  url: string | null;
  description: string | null;
  interestedAt: string;
  book: {
    id: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
  } | null;
  books: Array<{
    id: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
  }>;
  work: {
    id: string;
    title: string;
    author: string;
  } | null;
  organizer: {
    id: string;
    name: string | null;
    handle: string | null;
    image: string | null;
  };
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }) +
    " " +
    d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
  );
}

function eventHref(event: EventItem) {
  const bookId = event.book?.id ?? event.books[0]?.id;
  if (bookId) return `/books/${bookId}`;
  if (event.work?.id) return `/works/${event.work.id}`;
  return "/events";
}

export default function InterestedEventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    fetch(apiUrl(`/api/me/interested-events?page=${page}`))
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        if (data.pagination) setPagination(data.pagination);
      })
      .finally(() => setLoading(false));
  }, [page, status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">
            気になる読書会
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            自分が気になるを押した読書会を確認できます。
          </p>
        </div>
        <Link href="/mypage" className="text-sm text-[var(--color-accent)] hover:underline">
          マイページへ
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="card-base p-8 text-center">
          <p className="text-[var(--color-ink-muted)]">気になる読書会はまだありません</p>
          <Link href="/events" className="mt-4 inline-block btn-primary">
            読書会を探す
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const displayBook = event.book ?? event.books[0] ?? null;
            return (
              <article key={event.id} className="card-base p-4">
                <div className="flex gap-3">
                  {displayBook?.coverImageUrl ? (
                    <Link href={`/books/${displayBook.id}`} className="shrink-0">
                      <img
                        src={displayBook.coverImageUrl}
                        alt={displayBook.title}
                        className="h-20 w-14 rounded object-cover shadow-[var(--shadow-cover)]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </Link>
                  ) : (
                    <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded bg-[rgb(31_42_68_/_0.05)] text-[10px] text-[var(--color-ink-faint)]">
                      No Image
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {displayBook ? (
                      <Link href={`/books/${displayBook.id}`} className="text-xs text-[var(--color-accent)] hover:underline">
                        {displayBook.title}
                        <span className="ml-1 text-[var(--color-ink-faint)]">/ {displayBook.author}</span>
                      </Link>
                    ) : event.work ? (
                      <p className="text-xs text-[var(--color-accent)]">
                        {event.work.title}
                        <span className="ml-1 text-[var(--color-ink-faint)]">/ {event.work.author}</span>
                      </p>
                    ) : null}
                    <h2 className="mt-1 font-serif text-base font-medium text-[var(--color-ink-primary)]">
                      <Link href={eventHref(event)} className="hover:text-[var(--color-accent)]">
                        {event.title}
                      </Link>
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-ink-muted)]">
                      <span>📅 {formatDate(event.eventDate)}</span>
                      <span>📍 {event.prefecture} {event.location}</span>
                      <Link href={`/users/${event.organizer.id}`} className="text-[var(--color-accent)] hover:underline">
                        👤 {event.organizer.name || event.organizer.handle || "主催者"}
                      </Link>
                    </div>
                    {event.description ? (
                      <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{event.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ReadingEventInterestButton eventId={event.id} isOrganizer={false} />
                      {event.url ? (
                        <a href={event.url} target="_blank" rel="noopener noreferrer" className="btn-primary-sm text-[11px]">
                          詳細・申込
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page <= 1}
            className="btn-secondary-sm disabled:opacity-50"
          >
            前へ
          </button>
          <span className="text-sm text-[var(--color-ink-muted)]">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={pagination.page >= pagination.totalPages}
            className="btn-secondary-sm disabled:opacity-50"
          >
            次へ
          </button>
        </div>
      ) : null}
    </div>
  );
}
