"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-amber-700">
          📖 文とも
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <a
            href="https://bunkare.jp/"
            className="text-gray-500 hover:text-amber-700 text-xs"
          >
            📅 文学カレンダー
          </a>
          {session ? (
            <>
              <Link href="/books/search" className="text-gray-600 hover:text-amber-700">
                本を探す
              </Link>
              <Link href="/events" className="text-gray-600 hover:text-amber-700">
                読書会
              </Link>
              <Link href="/mypage" className="flex items-center gap-1.5 text-gray-600 hover:text-amber-700">
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
                className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-600 hover:bg-gray-200"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-gray-600 hover:text-amber-700"
              >
                ログイン
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700"
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
