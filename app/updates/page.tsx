import Link from "next/link";
import { updates } from "@/lib/updates";

const typeStyles: Record<string, string> = {
  新機能: "border-emerald-200 bg-emerald-50 text-emerald-700",
  改善: "border-blue-200 bg-blue-50 text-blue-700",
  修正: "border-amber-200 bg-amber-50 text-amber-700",
  お知らせ: "border-[var(--color-border-subtle)] bg-[var(--color-bg-soft)] text-[var(--color-ink-muted)]",
};

export const metadata = {
  title: "更新のお知らせ",
  description: "ブントモの新機能や小さな改善を、まとめてお知らせします。",
};

export default function UpdatesPage() {
  const sortedUpdates = [...updates].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)]">
          更新のお知らせ
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          ブントモの新機能や小さな改善を、まとめてお知らせします。
        </p>
      </div>

      <div className="space-y-4 border-l border-[var(--color-border-subtle)] pl-5">
        {sortedUpdates.map((entry) => (
          <article key={entry.id} className="relative card-base p-5">
            <span className="absolute -left-[1.85rem] top-6 h-3 w-3 rounded-full border-2 border-[var(--color-bg-elevated)] bg-[var(--color-accent)]" />
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <time className="text-xs text-[var(--color-ink-faint)]" dateTime={entry.date}>
                {entry.date}
              </time>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${typeStyles[entry.type]}`}>
                {entry.type}
              </span>
            </div>
            <h2 className="font-serif text-lg font-medium text-[var(--color-ink-primary)]">
              {entry.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {entry.body}
            </p>
            {entry.href && (
              <Link
                href={entry.href}
                className="mt-4 inline-flex text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                関連ページを見る
              </Link>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
