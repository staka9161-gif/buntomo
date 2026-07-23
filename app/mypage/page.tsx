"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import BookCard from "@/components/book/BookCard";

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

interface ChatHistoryItem {
  book: {
    id: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
  };
  lastMessageAt: string;
  myMessageCount: number;
  totalMessageCount: number;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}ヶ月前`;
  return `${Math.floor(months / 12)}年前`;
}

export default function MyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [readingBooks, setReadingBooks] = useState<Reading[]>([]);
  const [completedBooks, setCompletedBooks] = useState<Reading[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [profile, setProfile] = useState<{
    name: string | null;
    handle: string | null;
    image: string | null;
    bio: string | null;
    area: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchAll = () => {
    Promise.all([
      fetch(apiUrl("/api/me/readings?status=reading")).then((r) => r.json()).catch(() => ({ readings: [] })),
      fetch(apiUrl("/api/me/readings?status=completed")).then((r) => r.json()).catch(() => ({ readings: [] })),
      fetch(apiUrl("/api/me/chat-history")).then((r) => r.json()).catch(() => ({ chatHistory: [] })),
      fetch(apiUrl("/api/me/friends")).then((r) => r.json()).catch(() => ({ friends: [] })),
      fetch(apiUrl("/api/me/friends/requests")).then((r) => r.json()).catch(() => ({ received: [] })),
      fetch(apiUrl("/api/me/profile")).then((r) => r.json()).catch(() => ({ profile: null })),
    ]).then(([readingData, completedData, chatData, friendData, requestData, profileData]) => {
      setReadingBooks(readingData.readings || []);
      setCompletedBooks(completedData.readings || []);
      setChatHistory(chatData.chatHistory || []);
      setFriendCount((friendData.friends || []).length);
      setPendingRequestCount((requestData.received || []).length);
      if (profileData.profile) setProfile(profileData.profile);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (status === "authenticated") fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleStatusChange = async (readingId: string, newStatus: string) => {
    await fetch(apiUrl(`/api/me/readings/${readingId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchAll();
  };

  const handleUpdatePage = async (readingId: string, page: number) => {
    await fetch(apiUrl(`/api/me/readings/${readingId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPage: page }),
    });
    fetchAll();
  };

  const handleReadingRemoved = (readingStatusId: string) => {
    setReadingBooks((current) =>
      current.filter((reading) => reading.id !== readingStatusId)
    );
  };

  const handleDelete = async (readingId: string) => {
    const res = await fetch(apiUrl(`/api/me/readings/${readingId}`), { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-ink-faint)]">読み込み中...</p>
      </div>
    );
  }

  if (!session) return null;

  const validReadingBooks = readingBooks.filter(
    (reading): reading is Reading & { book: NonNullable<Reading["book"]> } => !!reading.book?.id
  );
  const validCompletedBooks = completedBooks.filter(
    (reading): reading is Reading & { book: NonNullable<Reading["book"]> } => !!reading.book?.id
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/users/${session.user?.id}`}
        className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-border-faint)] bg-[var(--color-bg-elevated)] p-3 hover:bg-[var(--color-bg-base)] transition-colors"
      >
        {(profile?.image || session.user?.image) ? (
          <img
            src={profile?.image || session.user?.image || ""}
            alt=""
            className="h-10 w-10 rounded-full object-cover shadow-[var(--shadow-cover)]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)]">
            {profile?.name?.charAt(0) || session.user?.name?.charAt(0) || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-serif text-sm font-medium text-[var(--color-ink-primary)] truncate">{profile?.name || session.user?.name}</p>
          {profile?.handle && (
            <p className="text-xs font-mono text-[var(--color-ink-faint)]">@{profile.handle}</p>
          )}
          <p className="text-xs text-[var(--color-ink-muted)]">プロフィールを見る →</p>
        </div>
      </Link>

      <div className="mb-8 grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Link
          href="/mypage/reading"
          className="card-base p-4 text-center md:p-5"
        >
          <p className="font-serif text-2xl font-medium leading-none text-[var(--color-accent)] md:text-3xl">{validReadingBooks.length}</p>
          <p className="mt-2 text-[11px] tracking-[0.05em] text-[var(--color-ink-muted)] md:text-xs">読みかけの本</p>
        </Link>
        <Link
          href="/mypage/completed"
          className="card-base p-4 text-center md:p-5"
        >
          <p className="font-serif text-2xl font-medium leading-none text-[var(--color-accent)] md:text-3xl">{validCompletedBooks.length}</p>
          <p className="mt-2 text-[11px] tracking-[0.05em] text-[var(--color-ink-muted)] md:text-xs">読了した本</p>
        </Link>
        <Link
          href="/mypage/friends"
          className="relative card-base p-4 text-center md:p-5"
        >
          <p className="font-serif text-2xl font-medium leading-none text-[var(--color-accent)] md:text-3xl">{friendCount}</p>
          <p className="mt-2 text-[11px] tracking-[0.05em] text-[var(--color-ink-muted)] md:text-xs">友だち</p>
          {pendingRequestCount > 0 && (
            <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-bold text-[var(--color-bg-elevated)]">
              {pendingRequestCount}
            </span>
          )}
        </Link>
        <Link
          href="/mypage/messages"
          className="card-base p-4 text-center md:p-5"
        >
          <div className="flex justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.5 8.5 0 0 1 3 11.5a8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 9.5 8.5z"/>
            </svg>
          </div>
          <p className="mt-2 text-[11px] tracking-[0.05em] text-[var(--color-ink-muted)] md:text-xs">メッセージ</p>
        </Link>
        <Link
          href="/mypage/interested-events"
          className="card-base p-4 text-center md:p-5"
        >
          <div className="flex justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
            </svg>
          </div>
          <p className="mt-2 text-[11px] tracking-[0.05em] text-[var(--color-ink-muted)] md:text-xs">気になる読書会</p>
        </Link>
        <Link
          href="/books/search"
          className="card-base p-4 text-center md:p-5"
        >
          <div className="flex justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <p className="mt-2 text-[11px] tracking-[0.05em] text-[var(--color-ink-muted)] md:text-xs">本を探す</p>
        </Link>
      </div>

      {validReadingBooks.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-base font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-lg">読みかけの本</h2>
            <Link href="/mypage/reading" className="text-sm text-[var(--color-accent)] hover:underline transition-colors">
              すべて見る →
            </Link>
          </div>
          <div className="space-y-3">
            {validReadingBooks.slice(0, 3).map((r) => (
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
                onRemoveReading={handleReadingRemoved}
              />
            ))}
          </div>
        </section>
      )}

      {validCompletedBooks.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-base font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-lg">最近読了した本</h2>
            <Link href="/mypage/completed" className="text-sm text-[var(--color-accent)] hover:underline transition-colors">
              すべて見る →
            </Link>
          </div>
          <div className="space-y-3">
            {validCompletedBooks.slice(0, 3).map((r) => (
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
        </section>
      )}

      {chatHistory.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-serif text-base font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-lg">最近のチャット</h2>
          <div className="space-y-2">
            {chatHistory.slice(0, 5).map((item) => (
              <Link
                key={item.book.id}
                href={`/books/${item.book.id}/chat`}
                className="card-base flex items-center gap-3 p-3 transition hover:shadow-md"
              >
                {item.book.coverImageUrl ? (
                  <img
                    src={item.book.coverImageUrl}
                    alt={item.book.title}
                    className="h-12 w-8 shrink-0 rounded-sm shadow-[var(--shadow-cover)] object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-[9px] text-[var(--color-ink-faint)]">
                    No Image
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-sm font-medium text-[var(--color-ink-primary)]">{item.book.title}</p>
                  <p className="truncate text-xs text-[var(--color-ink-muted)]">{item.book.author}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-mono text-[var(--color-ink-faint)]">
                    {formatRelativeTime(item.lastMessageAt)}
                  </p>
                  <p className="text-[11px] text-[var(--color-ink-faint)]">
                    {item.totalMessageCount}件{item.myMessageCount > 0 && ` (自分${item.myMessageCount}件)`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {validReadingBooks.length === 0 && validCompletedBooks.length === 0 && (
        <div className="card-base p-8 text-center">
          <p className="text-[var(--color-ink-muted)]">まだ本が登録されていません</p>
          <Link
            href="/books/search"
            className="mt-4 inline-block btn-primary"
          >
            本を探す
          </Link>
        </div>
      )}
    </div>
  );
}
