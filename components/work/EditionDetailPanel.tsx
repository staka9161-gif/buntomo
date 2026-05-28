"use client";

interface Edition {
  id: string;
  isbn13: string | null;
  isbn10: string | null;
  publisher: string | null;
  format: string;
  pageCount: number | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  titleOnCover: string;
  source: string;
}

interface EditionDetailPanelProps {
  edition: Edition;
  onAddToBookshelf: (editionId: string) => void;
  isLoggedIn: boolean;
  isAlreadyRegistered: boolean;
}

const FORMAT_LABELS: Record<string, string> = {
  hardcover: "単行本",
  paperback: "ペーパーバック",
  bunko: "文庫",
  shinsho: "新書",
  ebook: "電子書籍",
  audiobook: "オーディオブック",
  other: "その他",
};

export default function EditionDetailPanel({
  edition,
  onAddToBookshelf,
  isLoggedIn,
  isAlreadyRegistered,
}: EditionDetailPanelProps) {
  const year = edition.publishedAt
    ? new Date(edition.publishedAt).getFullYear()
    : null;

  return (
    <div className="card-base p-5">
      <div className="flex gap-4">
        {edition.coverImageUrl ? (
          <img
            src={edition.coverImageUrl}
            alt={edition.titleOnCover}
            className="h-36 w-24 shrink-0 rounded-sm object-cover shadow-[var(--shadow-cover)]"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              el.style.display = "none";
              el.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`flex h-36 w-24 shrink-0 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-xs text-[var(--color-ink-faint)] ${edition.coverImageUrl ? "hidden" : ""}`}>
          No Image
        </div>

        <div className="flex-1">
          <h3 className="font-serif text-base font-medium text-[var(--color-ink-primary)]">{edition.titleOnCover}</h3>

          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-xs tracking-[0.05em] text-[var(--color-ink-muted)]">判型</dt>
            <dd className="text-sm text-[var(--color-ink-primary)]">{FORMAT_LABELS[edition.format] || edition.format}</dd>

            {edition.publisher && (
              <>
                <dt className="text-xs tracking-[0.05em] text-[var(--color-ink-muted)]">出版社</dt>
                <dd className="text-sm text-[var(--color-ink-primary)]">{edition.publisher}</dd>
              </>
            )}

            {year && (
              <>
                <dt className="text-xs tracking-[0.05em] text-[var(--color-ink-muted)]">発売年</dt>
                <dd className="text-sm text-[var(--color-ink-primary)]">{year}年</dd>
              </>
            )}

            {edition.pageCount && (
              <>
                <dt className="text-xs tracking-[0.05em] text-[var(--color-ink-muted)]">ページ数</dt>
                <dd className="text-sm font-mono text-[var(--color-ink-primary)]">{edition.pageCount}ページ</dd>
              </>
            )}

            {edition.isbn13 && (
              <>
                <dt className="text-xs tracking-[0.05em] text-[var(--color-ink-muted)]">ISBN</dt>
                <dd className="font-mono text-xs text-[var(--color-ink-primary)]">{edition.isbn13}</dd>
              </>
            )}
          </dl>

          <div className="mt-3">
            {isAlreadyRegistered ? (
              <span className="inline-block bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-xs px-2 py-0.5 rounded-full">
                この作品は本棚に登録済みです
              </span>
            ) : isLoggedIn ? (
              <button
                onClick={() => onAddToBookshelf(edition.id)}
                className="btn-primary-sm"
              >
                この版を本棚に追加
              </button>
            ) : (
              <p className="text-sm text-[var(--color-ink-faint)]">
                本棚に追加するにはログインしてください
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
