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
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex gap-4">
        {edition.coverImageUrl ? (
          <img
            src={edition.coverImageUrl}
            alt={edition.titleOnCover}
            className="h-36 w-24 shrink-0 rounded object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-36 w-24 shrink-0 items-center justify-center rounded bg-gray-200 text-xs text-gray-400">
            No Image
          </div>
        )}

        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{edition.titleOnCover}</h3>

          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">判型</dt>
            <dd className="text-gray-700">{FORMAT_LABELS[edition.format] || edition.format}</dd>

            {edition.publisher && (
              <>
                <dt className="text-gray-500">出版社</dt>
                <dd className="text-gray-700">{edition.publisher}</dd>
              </>
            )}

            {year && (
              <>
                <dt className="text-gray-500">発売年</dt>
                <dd className="text-gray-700">{year}年</dd>
              </>
            )}

            {edition.pageCount && (
              <>
                <dt className="text-gray-500">ページ数</dt>
                <dd className="text-gray-700">{edition.pageCount}ページ</dd>
              </>
            )}

            {edition.isbn13 && (
              <>
                <dt className="text-gray-500">ISBN</dt>
                <dd className="text-gray-700 font-mono text-xs">{edition.isbn13}</dd>
              </>
            )}
          </dl>

          <div className="mt-3">
            {isAlreadyRegistered ? (
              <span className="inline-block rounded bg-amber-100 px-3 py-1.5 text-sm text-amber-700">
                この作品は本棚に登録済みです
              </span>
            ) : isLoggedIn ? (
              <button
                onClick={() => onAddToBookshelf(edition.id)}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                この版を本棚に追加
              </button>
            ) : (
              <p className="text-sm text-gray-400">
                本棚に追加するにはログインしてください
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
