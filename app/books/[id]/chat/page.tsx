"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import ChatRoom from "@/components/chat/ChatRoom";

export default function BookChatPage() {
  const params = useParams();
  const bookId = params.id as string;
  const [book, setBook] = useState<{ id: string; title: string; author: string } | null>(null);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    fetch(apiUrl(`/api/books/${bookId}`))
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setBook(data.book);
        setEventCount(data.eventCount ?? 0);
      })
      .catch(() => {
        // network error - header stays hidden
      });
  }, [bookId]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {book && (
        <div className="mb-6">
          <Link
            href={`/books/${book.id}`}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            ← 本の詳細に戻る
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="font-serif text-xl font-medium text-[var(--color-ink-primary)]">{book.title}</h1>
            <Link
              href={`/books/${book.id}#events`}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                eventCount > 0
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                  : "bg-[rgb(31_42_68_/_0.04)] text-[var(--color-ink-faint)]"
              }`}
            >
              📅 読書会 {eventCount}件
            </Link>
          </div>
          <p className="text-sm text-[var(--color-ink-muted)]">{book.author}</p>
        </div>
      )}

      <ChatRoom bookId={bookId} />
    </div>
  );
}
