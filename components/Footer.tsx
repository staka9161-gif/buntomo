import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="w-full border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start">
          <Link href="/" className="flex items-center" aria-label="ホームに戻る">
            <Image src="/logo.png" alt="ブントモ" height={20} width={75} className="h-5 w-auto opacity-60" />
          </Link>
          <p className="text-[11px] text-[var(--color-ink-faint)]">
            &copy; 2026
          </p>
          <Link href="/terms" className="text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-accent)] transition-colors">
            利用規約
          </Link>
          <Link href="/privacy" className="text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-accent)] transition-colors">
            プライバシーポリシー
          </Link>
          <a
            href="mailto:tamanakabook@metromonk.tokyo"
            className="text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-accent)] transition-colors"
          >
            お問い合わせ
          </a>
          <a
            href="https://bunkare.jp/"
            className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-accent)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            文学カレンダー
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
