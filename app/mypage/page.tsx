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
  };
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
    avatarUrl: string | null;
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

  const handleDelete = async (readingId: string) => {
    const res = await fetch(apiUrl(`/api/me/readings/${readingId}`), { method: "DELETE" });
    if (res.ok) fetchAll();
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href={`/users/${session.user?.id}`} className="shrink-0">
            {(profile?.avatarUrl || session.user?.image) ? (
              <img
                src={profile?.avatarUrl || session.user?.image || ""}
                alt=""
                className="h-16 w-16 rounded-full object-cover border-2 border-gray-200 hover:border-amber-400 transition"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-200 text-xl font-bold text-amber-800 hover:ring-2 hover:ring-amber-400 transition">
                {session.user?.name?.charAt(0) || "?"}
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/users/${session.user?.id}`} className="hover:underline">
              <h1 className="text-xl font-bold text-gray-900 truncate">{session.user?.name}</h1>
            </Link>
            {profile?.area && (
              <p className="text-xs text-gray-500">📍 {profile.area}</p>
            )}
            {profile?.bio && (
              <p className="mt-0.5 text-sm text-gray-600 truncate">{profile.bio}</p>
            )}
          </div>
          <Link
            href="/mypage/profile"
            className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm hover:bg-gray-50"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="mb-8 grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Link
          href="/mypage/reading"
          className="rounded-xl border bg-white p-6 text-center shadow-sm hover:shadow-md"
        >
          <p className="text-3xl font-bold text-amber-600">{readingBooks.length}</p>
          <p className="mt-1 text-sm text-gray-500">読みかけの本</p>
        </Link>
        <Link
          href="/mypage/completed"
          className="rounded-xl border bg-white p-6 text-center shadow-sm hover:shadow-md"
        >
          <p className="text-3xl font-bold text-green-600">{completedBooks.length}</p>
          <p className="mt-1 text-sm text-gray-500">読了した本</p>
        </Link>
        <Link
          href="/mypage/friends"
          className="relative rounded-xl border bg-white p-6 text-center shadow-sm hover:shadow-md"
        >
          <p className="text-3xl font-bold text-purple-600">{friendCount}</p>
          <p className="mt-1 text-sm text-gray-500">友だち</p>
          {pendingRequestCount > 0 && (
            <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {pendingRequestCount}
            </span>
          )}
        </Link>
        <Link
          href="/mypage/messages"
          className="rounded-xl border bg-white p-6 text-center shadow-sm hover:shadow-md"
        >
          <p className="text-3xl font-bold text-blue-600">💬</p>
          <p className="mt-1 text-sm text-gray-500">メッセージ</p>
        </Link>
        <Link
          href="/books/search"
          className="rounded-xl border bg-white p-6 text-center shadow-sm hover:shadow-md"
        >
          <p className="text-3xl font-bold text-blue-600">+</p>
          <p className="mt-1 text-sm text-gray-500">本を探す</p>
        </Link>
      </div>

      {readingBooks.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">読みかけの本</h2>
            <Link href="/mypage/reading" className="text-sm text-amber-600 hover:underline">
              すべて見る →
            </Link>
          </div>
          <div className="space-y-3">
            {readingBooks.slice(0, 3).map((r) => (
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
        </section>
      )}

      {completedBooks.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">最近読了した本</h2>
            <Link href="/mypage/completed" className="text-sm text-amber-600 hover:underline">
              すべて見る →
            </Link>
          </div>
          <div className="space-y-3">
            {completedBooks.slice(0, 3).map((r) => (
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
          <h2 className="mb-3 text-lg font-semibold text-gray-800">最近のチャット</h2>
          <div className="space-y-2">
            {chatHistory.slice(0, 5).map((item) => (
              <Link
                key={item.book.id}
                href={`/books/${item.book.id}/chat`}
                className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition hover:shadow-md"
              >
                {item.book.coverImageUrl ? (
                  <img
                    src={item.book.coverImageUrl}
                    alt={item.book.title}
                    className="h-12 w-8 shrink-0 rounded object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] text-gray-400">
                    No Image
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.book.title}</p>
                  <p className="truncate text-xs text-gray-400">{item.book.author}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-500">
                    {formatRelativeTime(item.lastMessageAt)}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {item.totalMessageCount}件{item.myMessageCount > 0 && ` (自分${item.myMessageCount}件)`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {readingBooks.length === 0 && completedBooks.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-gray-500">まだ本が登録されていません</p>
          <Link
            href="/books/search"
            className="mt-4 inline-block rounded-lg bg-amber-600 px-6 py-2 text-white hover:bg-amber-700"
          >
            本を探す
          </Link>
        </div>
      )}
    </div>
  );
}
