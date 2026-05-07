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
  "bg-[var(--color-accent)]",
  "bg-[rgb(184_71_60_/_0.55)]",
  "bg-[rgb(184_71_60_/_0.3)]",
  "bg-[rgb(31_42_68_/_0.15)]",
  "bg-[rgb(31_42_68_/_0.1)]",
  "bg-[rgb(31_42_68_/_0.06)]",
];

export default function EditionDistributionBar({
  distribution,
  editions,
}: EditionDistributionBarProps) {
  if (distribution.length === 0) return null;

  const editionMap = new Map(editions.map((e) => [e.id, e]));

  return (
    <div>
      <h2 className="mb-2 text-xs text-[var(--color-ink-muted)]">読者の版の分布</h2>

      {/* 横バー */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[rgb(31_42_68_/_0.06)]">
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
            <div key={entry.edition_id} className="flex items-center gap-1.5 text-[10px] text-[var(--color-ink-primary)]">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${COLORS[i % COLORS.length]}`} />
              <span>{detail}</span>
              <span className="font-mono text-[var(--color-ink-faint)]">{Math.round(entry.percentage * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
