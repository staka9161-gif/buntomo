"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api";

type Announcement = {
  id: string;
  title: string;
  body: string;
  level: string;
  publishedAt: string;
  expiresAt: string | null;
  isRead: boolean;
};

type AnnouncementResponse = {
  authenticated: boolean;
  announcements: Announcement[];
};

const excludedPathPrefixes = ["/admin", "/mypage/messages", "/account/suspended", "/api"];
const localDismissPrefix = "important-announcement-dismissed:";

function isExcludedPath(pathname: string | null) {
  if (!pathname) return false;
  return excludedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function levelClasses(level: string) {
  if (level === "urgent") {
    return "border-red-200 bg-red-50 text-red-950";
  }
  if (level === "maintenance") {
    return "border-sky-200 bg-sky-50 text-sky-950";
  }
  return "border-amber-200 bg-amber-50 text-amber-950";
}

export default function ImportantAnnouncementBanner() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const ids = new Set<string>();
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(localDismissPrefix)) {
        ids.add(key.slice(localDismissPrefix.length));
      }
    }
    return ids;
  });

  useEffect(() => {
    if (status === "loading" || isExcludedPath(pathname)) return;
    if (session?.user?.accountStatus === "suspended") return;

    let ignore = false;

    fetch(apiUrl("/api/announcements"), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AnnouncementResponse | null) => {
        if (ignore || !data) return;
        setAnnouncements(data.announcements);
        setAuthenticated(data.authenticated);
      })
      .catch(() => {
        if (!ignore) setAnnouncements([]);
      });

    return () => {
      ignore = true;
    };
  }, [pathname, session?.user?.accountStatus, status]);

  const announcement = useMemo(
    () =>
      announcements.find(
        (item) => !item.isRead && !dismissedIds.has(item.id),
      ) ?? null,
    [announcements, dismissedIds],
  );

  async function handleDismiss() {
    if (!announcement) return;

    if (authenticated) {
      const res = await fetch(apiUrl(`/api/announcements/${announcement.id}/read`), {
        method: "POST",
      });
      if (!res.ok) return;
    } else if (typeof window !== "undefined") {
      window.localStorage.setItem(`${localDismissPrefix}${announcement.id}`, "1");
    }

    setDismissedIds((current) => {
      const next = new Set(current);
      next.add(announcement.id);
      return next;
    });
    setAnnouncements((current) =>
      current.map((item) =>
        item.id === announcement.id ? { ...item, isRead: true } : item,
      ),
    );
  }

  if (!announcement || isExcludedPath(pathname)) {
    return null;
  }

  return (
    <section className={`border-b ${levelClasses(announcement.level)}`}>
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold">運営からの重要なお知らせ</p>
          <h2 className="mt-1 text-sm font-bold">{announcement.title}</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{announcement.body}</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-md border border-current/20 bg-white/70 px-3 py-2 text-xs font-semibold transition hover:bg-white"
        >
          確認しました
        </button>
      </div>
    </section>
  );
}
