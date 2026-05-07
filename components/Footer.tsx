import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-[11px] text-[var(--color-ink-faint)]">
            &copy; 2026 文とも
          </p>
          <a
            href="https://bunkare.jp/"
            className="text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-primary)] transition-colors"
          >
            今日の文学カレンダー
          </a>
        </div>
        <Link
          href="https://metromonk.tokyo/tamanaka/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink-primary)]"
        >
          <img
            src="/tamanaka-logo.png"
            alt="多摩中読書倶楽部"
            className="h-6 w-6 rounded-sm object-contain opacity-60"
          />
          <span className="text-[11px]">
            Operated by 多摩中読書倶楽部
          </span>
        </Link>
      </div>
    </footer>
  );
}
