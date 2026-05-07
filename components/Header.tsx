"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1.5 font-serif text-base tracking-[0.08em] text-[var(--color-ink-primary)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6">
            <path d="M2 4.5C2 3.67 2.67 3 3.5 3H11v18H3.5C2.67 21 2 20.33 2 19.5v-15z"/>
            <path d="M22 4.5C22 3.67 21.33 3 20.5 3H13v18h7.5c.83 0 1.5-.67 1.5-1.5v-15z"/>
          </svg>
          文とも
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
