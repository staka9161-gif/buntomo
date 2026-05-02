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
      <h2 className="mb-3 text-sm font-semibold text-gray-700">版を選択</h2>
      {groupKeys.map((groupId) => {
        const group = groupMap.get(groupId);
        const groupEditions = editionsByGroup[groupId];

        return (
          <div key={groupId} className="mb-4">
            {hasMultipleGroups && (
              <h3 className="mb-2 text-xs font-medium text-gray-500 border-b pb-1">
                {group ? group.label : "その他"}
                {group?.translator && (
                  <span className="ml-2 text-gray-400">訳: {group.translator}</span>
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
                        ? "border-amber-500 bg-amber-50 shadow"
                        : isUserEdition
                          ? "border-amber-300 bg-amber-25"
                          : "border-gray-200 hover:border-gray-300"
                      }
                    `}
                  >
                    {edition.coverImageUrl ? (
                      <img
                        src={edition.coverImageUrl}
                        alt={edition.titleOnCover}
                        className="h-24 w-16 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-16 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                        No Image
                      </div>
                    )}

                    <div className="mt-1.5 w-full text-center">
                      <p className="truncate text-xs font-medium text-gray-700">
                        {FORMAT_LABELS[edition.format] || edition.format}
                      </p>
                      {edition.publisher && (
                        <p className="truncate text-xs text-gray-400">{edition.publisher}</p>
                      )}
                      {year && (
                        <p className="text-xs text-gray-400">{year}年</p>
                      )}
                    </div>

                    {isUserEdition && (
                      <span className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
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
        <p className="text-sm text-gray-400">版の情報がありません</p>
      )}
    </div>
  );
}
