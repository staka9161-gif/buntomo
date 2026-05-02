"use client";

interface DistributionEntry {
  edition_id: string;
  count: number;
  percentage: number;
}

interface Edition {
  id: string;
  format: string;
  publisher: string | null;
  titleOnCover: string;
}

interface EditionDistributionBarProps {
  distribution: DistributionEntry[];
  editions: Edition[];
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

const COLORS = [
  "bg-amber-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
];

export default function EditionDistributionBar({
  distribution,
  editions,
}: EditionDistributionBarProps) {
  if (distribution.length === 0) return null;

  const editionMap = new Map(editions.map((e) => [e.id, e]));

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">読者の版の分布</h2>

      {/* 横バー */}
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
        {distribution.map((entry, i) => (
          <div
            key={entry.edition_id}
            className={`${COLORS[i % COLORS.length]} transition-all`}
            style={{ width: `${Math.max(entry.percentage * 100, 2)}%` }}
            title={`${Math.round(entry.percentage * 100)}%`}
          />
        ))}
      </div>

      {/* 凡例 */}
      <div className="mt-2 flex flex-wrap gap-3">
        {distribution.map((entry, i) => {
          const edition = editionMap.get(entry.edition_id);
          if (!edition) return null;
          const label = FORMAT_LABELS[edition.format] || edition.format;
          const detail = edition.publisher ? `${label} / ${edition.publisher}` : label;

          return (
            <div key={entry.edition_id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${COLORS[i % COLORS.length]}`} />
              <span>{detail}</span>
              <span className="text-gray-400">{Math.round(entry.percentage * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
