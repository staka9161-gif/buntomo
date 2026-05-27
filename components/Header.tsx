"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="ブントモ" height={48} width={96} priority className="h-12 w-auto" />
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
