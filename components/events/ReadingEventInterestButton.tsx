"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api";

type InterestedUser = {
  id: string;
  name: string | null;
  handle: string | null;
  image: string | null;
};

type InterestState = {
  count: number;
  isInterested: boolean;
  canViewInterestedUsers: boolean;
  interestedUsers?: InterestedUser[];
};

export default function ReadingEventInterestButton({
  eventId,
  isOrganizer,
  compact = false,
}: {
  eventId: string;
  isOrganizer: boolean;
  compact?: boolean;
}) {
  const { status } = useSession();
  const [state, setState] = useState<InterestState>({
    count: 0,
    isInterested: false,
    canViewInterestedUsers: false,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const fetchInterest = async () => {
    try {
      const res = await fetch(apiUrl(`/api/events/${eventId}/interest`), {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setState({
        count: Number(data.count || 0),
        isInterested: !!data.isInterested,
        canViewInterestedUsers: !!data.canViewInterestedUsers,
        interestedUsers: Array.isArray(data.interestedUsers) ? data.interestedUsers : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, status]);

  const toggleInterest = async () => {
    setMessage("");

    if (status !== "authenticated") {
      setMessage("ログインが必要です");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/events/${eventId}/interest`), {
        method: state.isInterested ? "DELETE" : "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.error || "操作に失敗しました");
        return;
      }

      setState((prev) => ({
        ...prev,
        count: Number(data.count ?? prev.count),
        isInterested: !!data.isInterested,
      }));
      setMessage(data.isInterested ? "気になるに保存しました" : "気になるを外しました");
    } finally {
      setSubmitting(false);
    }
  };

  const countLabel = `気になる ${state.count}人`;
  const buttonText = state.isInterested ? "気になる済み" : "気になる";

  if (loading) {
    return <span className="text-[10px] text-[var(--color-ink-faint)]">気になる -人</span>;
  }

  if (isOrganizer || state.canViewInterestedUsers) {
    return (
      <div className={compact ? "text-[10px]" : "text-xs"}>
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]">
            <span>{countLabel}</span>
            {state.canViewInterestedUsers && state.count > 0 ? (
              <span className="text-[var(--color-accent)]">見る</span>
            ) : null}
          </summary>
          {state.canViewInterestedUsers ? (
            <div className="mt-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-2">
              {state.interestedUsers && state.interestedUsers.length > 0 ? (
                <div className="space-y-1.5">
                  {state.interestedUsers.map((user) => (
                    <Link
                      key={user.id}
                      href={`/users/${user.id}`}
                      className="flex items-center gap-2 text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
                    >
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[10px] text-[var(--color-accent)]">
                          {(user.name || user.handle || "?").charAt(0)}
                        </span>
                      )}
                      <span className="truncate">
                        {user.name || "名前未設定"}
                        {user.handle ? <span className="ml-1 font-mono text-[var(--color-ink-faint)]">@{user.handle}</span> : null}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--color-ink-faint)]">まだ気になるした人はいません</p>
              )}
            </div>
          ) : null}
        </details>
      </div>
    );
  }

  return (
    <div className={compact ? "text-[10px]" : "text-xs"}>
      <button
        type="button"
        onClick={toggleInterest}
        disabled={submitting}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition disabled:opacity-60 ${
          state.isInterested
            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
            : "border-[var(--color-border-subtle)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        }`}
      >
        <span>{buttonText}</span>
        <span>{state.count}</span>
      </button>
      {message ? (
        <span className="ml-2 text-[10px] text-[var(--color-ink-faint)]">{message}</span>
      ) : null}
    </div>
  );
}
