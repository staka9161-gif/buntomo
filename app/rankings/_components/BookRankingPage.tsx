import Link from "next/link";
import { prisma } from "@/lib/db";
import type { ReadingStatusType } from "@prisma/client";
import RankingCover from "./RankingCover";

type RankingKind = "reading" | "completed";

interface BookRankingPageProps {
  kind: RankingKind;
}

interface RankingItem {
  rank: number;
  rankLabel: string;
  book: {
    id: string;
    title: string;
    author: string;
    coverImageUrl: string | null;
  };
  readerCount: number;
  eventCount: number;
}

const CONFIG: Record<RankingKind, {
  status: ReadingStatusType;
  title: string;
  description: string;
  tabLabel: string;
  countLabel: string;
}> = {
  reading: {
    status: "READING",
    title: "読まれてる本トップ10",
    description: "ブントモで読書中に登録されている本を集計しています。同数の場合は同じ順位で表示しています。",
    tabLabel: "読書中トップ10",
    countLabel: "読んでいる人",
  },
  completed: {
    status: "COMPLETED",
    title: "読了者が多い本トップ10",
    description: "ブントモで読了済みに登録されている本を集計しています。同数の場合は同じ順位で表示しています。",
    tabLabel: "読了トップ10",
    countLabel: "読了者",
  },
};

async function getRankingItems(kind: RankingKind): Promise<RankingItem[]> {
  const config = CONFIG[kind];
  const pairs = await prisma.readingStatus.groupBy({
    by: ["bookId", "userId"],
    where: {
      status: config.status,
      bookId: { not: null },
      book: { isNot: null },
      user: { is: { deactivatedAt: null } },
    },
  });

  const countByBookId = new Map<string, number>();
  for (const pair of pairs) {
    if (!pair.bookId) continue;
    countByBookId.set(pair.bookId, (countByBookId.get(pair.bookId) ?? 0) + 1);
  }

  const candidateBookIds = Array.from(countByBookId.keys());

  if (candidateBookIds.length === 0) return [];

  const [books, events] = await Promise.all([
    prisma.book.findMany({
      where: { id: { in: candidateBookIds } },
      select: {
        id: true,
        title: true,
        author: true,
        coverImageUrl: true,
      },
    }),
    prisma.readingEvent.findMany({
      where: {
        eventDate: { gte: new Date() },
        OR: [
          { bookId: { in: candidateBookIds } },
          { books: { some: { id: { in: candidateBookIds } } } },
        ],
      },
      select: {
        id: true,
        bookId: true,
        books: { select: { id: true } },
      },
    }),
  ]);

  const bookMap = new Map(books.map((book) => [book.id, book]));
  const eventCountMap = new Map<string, number>();
  for (const event of events) {
    const relatedBookIds = new Set<string>();
    if (event.bookId && candidateBookIds.includes(event.bookId)) {
      relatedBookIds.add(event.bookId);
    }
    for (const book of event.books) {
      if (candidateBookIds.includes(book.id)) {
        relatedBookIds.add(book.id);
      }
    }
    for (const bookId of relatedBookIds) {
      eventCountMap.set(bookId, (eventCountMap.get(bookId) ?? 0) + 1);
    }
  }

  const topItems = candidateBookIds
    .map((bookId) => {
      const book = bookMap.get(bookId);
      if (!book) return null;
      return {
        rank: 0,
        rankLabel: "",
        book,
        readerCount: countByBookId.get(bookId) ?? 0,
        eventCount: eventCountMap.get(bookId) ?? 0,
      };
    })
    .filter((item): item is RankingItem => item !== null)
    .sort((a, b) => {
      if (b.readerCount !== a.readerCount) return b.readerCount - a.readerCount;
      if (b.eventCount !== a.eventCount) return b.eventCount - a.eventCount;
      const titleCompare = a.book.title.localeCompare(b.book.title, "ja");
      if (titleCompare !== 0) return titleCompare;
      return a.book.id.localeCompare(b.book.id);
    })
    .slice(0, 10);

  const countFrequencies = new Map<number, number>();
  for (const item of topItems) {
    countFrequencies.set(item.readerCount, (countFrequencies.get(item.readerCount) ?? 0) + 1);
  }

  let currentRank = 0;
  let previousCount: number | null = null;
  return topItems.map((item) => {
    if (item.readerCount !== previousCount) {
      currentRank += 1;
      previousCount = item.readerCount;
    }
    const isTie = (countFrequencies.get(item.readerCount) ?? 0) > 1;
    return {
      ...item,
      rank: currentRank,
      rankLabel: `${currentRank}位${isTie ? "タイ" : ""}`,
    };
  });
}

export default async function BookRankingPage({ kind }: BookRankingPageProps) {
  const config = CONFIG[kind];
  const items = await getRankingItems(kind);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5">
        <h1 className="font-serif text-xl font-medium tracking-[0.05em] text-[var(--color-ink-primary)] md:text-2xl">
          {config.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          {config.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/rankings/reading"
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              kind === "reading"
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            }`}
          >
            {CONFIG.reading.tabLabel}
          </Link>
          <Link
            href="/rankings/completed"
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              kind === "completed"
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            }`}
          >
            {CONFIG.completed.tabLabel}
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card-base p-10 text-center text-sm text-[var(--color-ink-faint)]">
          まだランキング対象の本がありません
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.book.id}
              href={`/books/${item.book.id}`}
              className="card-base flex gap-3 p-3 transition hover:shadow-md md:gap-4 md:p-4"
            >
              <div className="flex w-14 shrink-0 items-start justify-center pt-1 text-center font-serif text-base font-medium text-[var(--color-accent)] md:w-16 md:text-lg">
                {item.rankLabel}
              </div>
              <div className="shrink-0">
                <RankingCover src={item.book.coverImageUrl} alt={item.book.title} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-serif text-sm font-medium text-[var(--color-ink-primary)] md:text-base">
                  {item.book.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                  {item.book.author || "作者不明"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-1 text-[var(--color-accent)]">
                    {config.countLabel} {item.readerCount}人
                  </span>
                  <span className="rounded-full bg-[rgb(31_42_68_/_0.05)] px-2 py-1 text-[var(--color-ink-muted)]">
                    予定読書会 {item.eventCount}件
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
