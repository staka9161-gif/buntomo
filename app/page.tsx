import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="w-full bg-[var(--color-bg-base)] px-4 py-14 text-center md:py-20">
        <h1 className="font-serif text-3xl font-medium tracking-[0.06em] leading-[1.5] text-[var(--color-ink-primary)] md:text-4xl">
          読書を、もっと<span className="text-[var(--color-accent)]">一緒に</span>。
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-[1.9] text-[var(--color-ink-muted)] md:mt-5 md:text-base">
          読みかけの本の進捗を管理し、同じ本を読んでいる人と出会い、
          読了の余韻を分かち合える読書支援サービスです。
        </p>
        <div className="mt-7 flex justify-center gap-3 md:mt-8">
          <Link
            href="/signup"
            className="btn-primary"
          >
            無料で始める
          </Link>
          <Link
            href="/login"
            className="btn-secondary"
          >
            ログイン
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="w-full border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] py-12 md:py-16">
        <div className="flex items-center justify-center gap-4 mb-8 md:mb-10">
          <span className="h-px w-6 bg-[rgb(31_42_68_/_0.3)]" aria-hidden />
          <h2 className="font-serif text-lg font-medium tracking-[0.18em] text-[var(--color-ink-primary)] m-0 md:text-xl">
            文ともの特徴
          </h2>
          <span className="h-px w-6 bg-[rgb(31_42_68_/_0.3)]" aria-hidden />
        </div>
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-3 px-4 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border-faint)] bg-[var(--color-bg-base)] p-6 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent-soft)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="13" width="4" height="8" rx="1"/>
                <rect x="10" y="7" width="4" height="14" rx="1"/>
                <rect x="17" y="10" width="4" height="11" rx="1"/>
              </svg>
            </div>
            <h3 className="mb-2 font-serif text-base font-medium tracking-[0.05em] text-[var(--color-ink-primary)]">読書進捗の可視化</h3>
            <p className="m-0 text-xs leading-[1.8] text-[var(--color-ink-muted)] md:text-sm">
              今読んでいる本のページ数を記録して、進捗をパーセントで表示。読書のモチベーションが上がります。
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border-faint)] bg-[var(--color-bg-base)] p-6 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent-soft)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3"/>
                <circle cx="17" cy="9" r="2.5"/>
                <path d="M3 19c0-2.5 2.5-5 6-5s6 2.5 6 5"/>
                <path d="M14 18c0-2 2-4 4-4s3 1 3 3"/>
              </svg>
            </div>
            <h3 className="mb-2 font-serif text-base font-medium tracking-[0.05em] text-[var(--color-ink-primary)]">同じ本を読む仲間</h3>
            <p className="m-0 text-xs leading-[1.8] text-[var(--color-ink-muted)] md:text-sm">
              同じ本を「今」読んでいる人が見えるから、一人じゃない読書体験が得られます。
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border-faint)] bg-[var(--color-bg-base)] p-6 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent-soft)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.5 8.5 0 0 1 3 11.5a8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 9.5 8.5z"/>
              </svg>
            </div>
            <h3 className="mb-2 font-serif text-base font-medium tracking-[0.05em] text-[var(--color-ink-primary)]">読了チャット</h3>
            <p className="m-0 text-xs leading-[1.8] text-[var(--color-ink-muted)] md:text-sm">
              本を読み終えた人同士で感想を語り合える期間限定チャット。ネタバレを気にせず盛り上がれます。
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-4 py-12 text-center md:py-16">
        <h2 className="mb-3 font-serif text-xl font-medium tracking-[0.08em] text-[var(--color-ink-primary)] md:text-2xl">
          さっそく始めてみませんか？
        </h2>
        <p className="mb-6 text-sm text-[var(--color-ink-muted)]">無料で登録して、読書仲間を見つけましょう。</p>
        <Link
          href="/signup"
          className="btn-primary"
        >
          新規登録（無料）
        </Link>
      </section>

    </div>
  );
}
