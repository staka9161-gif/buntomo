"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { apiUrl } from "@/lib/api";

export default function Header() {
  const { data: session } = useSession();
  const [notifTotal, setNotifTotal] = useState(0);

  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchCounts = () => {
      fetch(apiUrl("/api/me/notifications/counts"))
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setNotifTotal(data.total ?? 0); })
        .catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  return (
    <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
      <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="ブントモ" height={64} width={128} priority className="h-16 w-auto" />
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {session ? (
            <>
              <Link href="/books/search" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors">
                本を探す
              </Link>
              <Link href="/events" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors">
                読書会
              </Link>
              <Link href="/mypage/notifications" className="relative text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors" aria-label="通知">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {notifTotal > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {notifTotal > 99 ? "99+" : notifTotal}
                  </span>
                )}
              </Link>
              <Link href="/mypage" className="flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors">
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : null}
                マイページ
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn-secondary-sm"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors"
              >
                ログイン
              </Link>
              <Link
                href="/signup"
                className="btn-primary-sm"
              >
                新規登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
