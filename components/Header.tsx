"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { apiUrl } from "@/lib/api";

function BellIcon({ count }: { count: number }) {
  return (
    <Link href="/mypage/notifications" className="relative text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors" aria-label="通知">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export default function Header() {
  const { data: session } = useSession();
  const [notifTotal, setNotifTotal] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

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
    window.addEventListener("notifications-seen", fetchCounts);
    return () => { clearInterval(interval); window.removeEventListener("notifications-seen", fetchCounts); };
  }, [session?.user?.id]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpen && !rankingOpen) return;
    const handler = () => {
      setMenuOpen(false);
      setRankingOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen, rankingOpen]);

  return (
    <header className="relative border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center rounded-lg overflow-hidden">
          <Image src="/logo.png" alt="ブントモ" height={40} width={151} priority className="h-10 w-auto" />
        </Link>

        {/* === PC nav (md+) === */}
        <nav className="hidden md:flex items-center gap-4 text-sm">
          {session ? (
            <>
              <Link href="/books/search" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors">
                本を探す
              </Link>
              <Link href="/events" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors">
                読書会を探す
              </Link>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setRankingOpen((v) => !v)}
                  className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors"
                  aria-haspopup="menu"
                  aria-expanded={rankingOpen}
                >
                  ランキング ▾
                </button>
                {rankingOpen && (
                  <div
                    className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-2 shadow-lg"
                    role="menu"
                  >
                    <Link
                      href="/rankings/reading"
                      onClick={() => setRankingOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-ink-primary)]"
                      role="menuitem"
                    >
                      読まれてる本トップ10
                    </Link>
                    <Link
                      href="/rankings/completed"
                      onClick={() => setRankingOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-ink-primary)]"
                      role="menuitem"
                    >
                      読了者が多い本トップ10
                    </Link>
                  </div>
                )}
              </div>
              <Link href="/updates" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors">
                お知らせ
              </Link>
              <BellIcon count={notifTotal} />
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
              <Link href="/login" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors">
                ログイン
              </Link>
              <Link href="/signup" className="btn-primary-sm">
                新規登録
              </Link>
            </>
          )}
        </nav>

        {/* === Mobile controls (< md) === */}
        <div className="flex md:hidden items-center gap-3">
          {session ? (
            <>
              <BellIcon count={notifTotal} />
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                className="flex items-center justify-center text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors"
                aria-label="メニュー"
              >
                {menuOpen ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6 6 18"/><path d="M6 6l12 12"/>
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>
                  </svg>
                )}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] transition-colors">
                ログイン
              </Link>
              <Link href="/signup" className="btn-primary-sm">
                新規登録
              </Link>
            </>
          )}
        </div>
      </div>

      {/* === Mobile dropdown menu === */}
      {menuOpen && session && (
        <nav
          className="md:hidden absolute left-0 right-0 top-full z-50 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-5xl px-4 py-2">
            <Link
              href="/books/search"
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] border-b border-[var(--color-border-subtle)] transition-colors"
            >
              本を探す
            </Link>
            <Link
              href="/events"
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] border-b border-[var(--color-border-subtle)] transition-colors"
            >
              読書会を探す
            </Link>
            <Link
              href="/mypage"
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] border-b border-[var(--color-border-subtle)] transition-colors"
            >
              マイページ
            </Link>
            <Link
              href="/rankings/reading"
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] border-b border-[var(--color-border-subtle)] transition-colors"
            >
              読まれてる本トップ10
            </Link>
            <Link
              href="/rankings/completed"
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] border-b border-[var(--color-border-subtle)] transition-colors"
            >
              読了者が多い本トップ10
            </Link>
            <Link
              href="/updates"
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink-primary)] border-b border-[var(--color-border-subtle)] transition-colors"
            >
              お知らせ
            </Link>
            <button
              onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
              className="block w-full py-3 text-left text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              ログアウト
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
