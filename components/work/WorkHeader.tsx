"use client";

interface WorkHeaderProps {
  title: string;
  author: string;
  originalTitle?: string | null;
  description?: string | null;
  stats: {
    currently_reading_count: number;
    completed_count: number;
    want_to_read_count: number;
    total_readers_count: number;
    average_rating: number | null;
    review_count: number;
  };
}

export default function WorkHeader({
  title,
  author,
  originalTitle,
  description,
  stats,
}: WorkHeaderProps) {
  return (
    <div>
      <h1 className="font-serif text-xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)] md:text-2xl">{title}</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{author}</p>
      {originalTitle && (
        <p className="mt-0.5 text-xs italic text-[var(--color-ink-faint)] font-serif">{originalTitle}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-4">
        <span className={`text-sm font-medium ${stats.currently_reading_count > 0 ? "text-[var(--color-accent)]" : "text-[var(--color-ink-faint)]"}`}>
          今 {stats.currently_reading_count}人が読んでいます
        </span>
        <span className={`text-sm ${stats.completed_count > 0 ? "text-[var(--color-status-success)]" : "text-[var(--color-ink-faint)]"}`}>
          {stats.completed_count}人が読了
        </span>
        <span className={`text-sm ${stats.want_to_read_count > 0 ? "text-[var(--color-ink-muted)]" : "text-[var(--color-ink-faint)]"}`}>
          {stats.want_to_read_count}人が読みたい
        </span>
      </div>

      {stats.average_rating != null && stats.review_count > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-[var(--color-accent)]">
            {"★".repeat(Math.round(stats.average_rating))}
            {"☆".repeat(5 - Math.round(stats.average_rating))}
          </span>
          <span className="text-sm text-[var(--color-ink-muted)]">
            {stats.average_rating.toFixed(1)} ({stats.review_count}件)
          </span>
        </div>
      )}

      {description && (
        <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-3">
          <h2 className="mb-2 font-serif text-sm font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-base">あらすじ</h2>
          <p className="text-sm leading-[1.9] text-[var(--color-ink-primary)]">{description}</p>
        </div>
      )}
    </div>
  );
}
