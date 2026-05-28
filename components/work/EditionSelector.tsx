"use client";

interface Edition {
  id: string;
  isbn13: string | null;
  publisher: string | null;
  format: string;
  pageCount: number | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  titleOnCover: string;
  translationGroupId: string | null;
}

interface TranslationGroup {
  id: string;
  translator: string | null;
  label: string;
}

interface EditionSelectorProps {
  editions: Edition[];
  translationGroups: TranslationGroup[];
  editionsByGroup: Record<string, Edition[]>;
  selectedId: string | null;
  userEditionId?: string | null;
  onSelect: (editionId: string) => void;
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

export default function EditionSelector({
  editions,
  translationGroups,
  editionsByGroup,
  selectedId,
  userEditionId,
  onSelect,
}: EditionSelectorProps) {
  const groupMap = new Map(translationGroups.map((g) => [g.id, g]));
  const groupKeys = Object.keys(editionsByGroup);
  const hasMultipleGroups = groupKeys.length > 1 || (groupKeys.length === 1 && groupKeys[0] !== "default");

  return (
    <div>
      <h2 className="mb-3 font-serif text-sm font-medium text-[var(--color-ink-primary)]">版を選択</h2>
      {groupKeys.map((groupId) => {
        const group = groupMap.get(groupId);
        const groupEditions = editionsByGroup[groupId];

        return (
          <div key={groupId} className="mb-4">
            {hasMultipleGroups && (
              <h3 className="mb-2 text-xs font-medium text-[var(--color-ink-muted)] border-b border-[var(--color-border-subtle)] pb-1">
                {group ? group.label : "その他"}
                {group?.translator && (
                  <span className="ml-2 text-[var(--color-ink-faint)]">訳: {group.translator}</span>
                )}
              </h3>
            )}

            <div className="flex gap-3 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible">
              {groupEditions.map((edition) => {
                const isSelected = edition.id === selectedId;
                const isUserEdition = edition.id === userEditionId;
                const year = edition.publishedAt
                  ? new Date(edition.publishedAt).getFullYear()
                  : null;

                return (
                  <button
                    key={edition.id}
                    onClick={() => onSelect(edition.id)}
                    className={`
                      flex shrink-0 flex-col items-center rounded-lg border-2 p-2 transition
                      w-28 md:w-32
                      ${isSelected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] shadow-[var(--shadow-card)]"
                        : isUserEdition
                          ? "border-[rgb(184_71_60_/_0.3)] bg-[var(--color-accent-soft)]"
                          : "border-[var(--color-border-faint)] hover:border-[var(--color-border-subtle)]"
                      }
                    `}
                  >
                    {edition.coverImageUrl ? (
                      <img
                        src={edition.coverImageUrl}
                        alt={edition.titleOnCover}
                        className="h-24 w-16 rounded-sm object-cover shadow-[var(--shadow-cover)]"
                        onError={(e) => {
                          const el = e.target as HTMLImageElement;
                          el.style.display = "none";
                          el.nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={`flex h-24 w-16 items-center justify-center rounded-sm bg-[rgb(31_42_68_/_0.05)] text-xs text-[var(--color-ink-faint)] ${edition.coverImageUrl ? "hidden" : ""}`}>
                      No Image
                    </div>

                    <div className="mt-1.5 w-full text-center">
                      <p className="truncate text-xs font-medium text-[var(--color-ink-primary)]">
                        {FORMAT_LABELS[edition.format] || edition.format}
                      </p>
                      {edition.publisher && (
                        <p className="truncate text-xs text-[var(--color-ink-muted)]">{edition.publisher}</p>
                      )}
                      {year && (
                        <p className="text-xs font-mono text-[var(--color-ink-faint)]">{year}年</p>
                      )}
                    </div>

                    {isUserEdition && (
                      <span className="mt-1 rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs text-[var(--color-accent)]">
                        登録中
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {editions.length === 0 && (
        <p className="text-sm text-[var(--color-ink-faint)]">版の情報がありません</p>
      )}
    </div>
  );
}
