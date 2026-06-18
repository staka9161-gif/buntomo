import Link from "next/link";
import { updateTopicTags, updates, type UpdateEntry } from "@/lib/updates";

const updateTypes: UpdateEntry["type"][] = ["新機能", "改善", "修正", "お知らせ"];

const typeStyles: Record<UpdateEntry["type"], string> = {
  新機能: "border-emerald-200 bg-emerald-50 text-emerald-700",
  改善: "border-blue-200 bg-blue-50 text-blue-700",
  修正: "border-amber-200 bg-amber-50 text-amber-700",
  お知らせ: "border-[var(--color-border-subtle)] bg-[var(--color-bg-soft)] text-[var(--color-ink-muted)]",
};

type SearchParams = {
  q?: string;
  sort?: string;
  type?: string;
  tag?: string;
};

type UpdatesPageProps = {
  searchParams: Promise<SearchParams>;
};

export const metadata = {
  title: "更新のお知らせ",
  description: "ブントモの新機能や小さな改善を、まとめてお知らせします。",
};

function normalizeQuery(value: string | undefined) {
  return (value ?? "").trim();
}

function buildUpdatesHref(params: SearchParams) {
  const search = new URLSearchParams();

  if (params.q) search.set("q", params.q);
  if (params.sort && params.sort !== "desc") search.set("sort", params.sort);
  if (params.type) search.set("type", params.type);
  if (params.tag) search.set("tag", params.tag);

  const query = search.toString();
  return query ? `/updates?${query}` : "/updates";
}

function matchesQuery(entry: UpdateEntry, query: string) {
  if (!query) return true;

  const normalizedQuery = query.toLocaleLowerCase();
  const searchableText = [entry.title, entry.body, entry.type, entry.topicTag]
    .join(" ")
    .toLocaleLowerCase();

  return searchableText.includes(normalizedQuery);
}

export default async function UpdatesPage({ searchParams }: UpdatesPageProps) {
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const sort = params.sort === "asc" ? "asc" : "desc";
  const selectedType = updateTypes.includes(params.type as UpdateEntry["type"])
    ? (params.type as UpdateEntry["type"])
    : "";
  const selectedTag = updateTopicTags.includes(params.tag as (typeof updateTopicTags)[number]) ? params.tag ?? "" : "";

  const filteredUpdates = updates
    .filter((entry) => matchesQuery(entry, query))
    .filter((entry) => !selectedType || entry.type === selectedType)
    .filter((entry) => !selectedTag || entry.topicTag === selectedTag)
    .sort((a, b) => (sort === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  const nextSort = sort === "asc" ? "desc" : "asc";
  const hasFilters = Boolean(query || selectedType || selectedTag);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-[0.06em] text-[var(--color-ink-primary)]">
          更新のお知らせ
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
          ブントモの新機能や小さな改善を、まとめてお知らせします。キーワードやタグで、気になる更新を探せます。
        </p>
      </div>

      <section className="mb-8 space-y-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-3 sm:p-4">
        <form action="/updates" className="flex flex-col gap-2.5 sm:flex-row">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="キーワードで探す"
            className="min-h-11 flex-1 rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-ink-primary)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15"
          />
          {sort === "asc" && <input type="hidden" name="sort" value="asc" />}
          {selectedType && <input type="hidden" name="type" value={selectedType} />}
          {selectedTag && <input type="hidden" name="tag" value={selectedTag} />}
          <button
            type="submit"
            className="min-h-11 rounded-md bg-[var(--color-accent)] px-5 text-sm font-medium text-white transition hover:opacity-90"
          >
            検索
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-xs font-medium text-[var(--color-ink-muted)]">種別</span>
          <Link
            href={buildUpdatesHref({ q: query, sort, tag: selectedTag })}
            className={`rounded-full border px-2.5 py-0.5 ${
              selectedType
                ? "border-[var(--color-border-subtle)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)]"
                : "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            }`}
          >
            すべて
          </Link>
          {updateTypes.map((type) => (
            <Link
              key={type}
              href={buildUpdatesHref({ q: query, sort, type, tag: selectedTag })}
              className={`rounded-full border px-2.5 py-0.5 ${
                selectedType === type
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "border-[var(--color-border-subtle)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)]"
              }`}
            >
              {type}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-xs font-medium text-[var(--color-ink-muted)]">内容タグ</span>
          <Link
            href={buildUpdatesHref({ q: query, sort, type: selectedType })}
            className={`rounded-full border px-2.5 py-0.5 ${
              selectedTag
                ? "border-[var(--color-border-subtle)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)]"
                : "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            }`}
          >
            すべて
          </Link>
          {updateTopicTags.map((tag) => (
            <Link
              key={tag}
              href={buildUpdatesHref({ q: query, sort, type: selectedType, tag })}
              className={`rounded-full border px-2.5 py-0.5 ${
                selectedTag === tag
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "border-[var(--color-border-subtle)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)]"
              }`}
            >
              {tag}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--color-border-subtle)] pt-3">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {filteredUpdates.length}件のお知らせ
            {hasFilters && <span className="ml-1">を表示中</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            {hasFilters && (
              <Link href="/updates" className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]">
                条件をクリア
              </Link>
            )}
            <Link
              href={buildUpdatesHref({ q: query, sort: nextSort, type: selectedType, tag: selectedTag })}
              className="rounded-full border border-[var(--color-border-subtle)] px-2.5 py-0.5 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-accent)]"
            >
              {sort === "asc" ? "古い順 ↑" : "新しい順 ↓"}
            </Link>
          </div>
        </div>
      </section>

      {filteredUpdates.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-soft)] p-6 text-sm text-[var(--color-ink-muted)]">
          条件に合うお知らせはありません。キーワードやタグを変えて探してみてください。
        </div>
      ) : (
        <div className="space-y-4 border-l border-[var(--color-border-subtle)] pl-5">
          {filteredUpdates.map((entry) => {
            const hasDetailPage = entry.href?.startsWith("/updates/") === true;

            return (
              <article key={entry.id} className="relative card-base p-5">
                <span className="absolute -left-[1.85rem] top-6 h-3 w-3 rounded-full border-2 border-[var(--color-bg-elevated)] bg-[var(--color-accent)]" />
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <time className="text-xs text-[var(--color-ink-faint)]" dateTime={entry.date}>
                    {entry.date}
                  </time>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${typeStyles[entry.type]}`}>
                    {entry.type}
                  </span>
                  {entry.topicTag && (
                    <Link
                      href={buildUpdatesHref({ tag: entry.topicTag, sort })}
                      className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      {entry.topicTag}
                    </Link>
                  )}
                </div>
                <h2 className="font-serif text-lg font-medium text-[var(--color-ink-primary)]">
                  {entry.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {entry.body}
                </p>
                {hasDetailPage && entry.href && (
                  <Link
                    href={entry.href}
                    className="mt-4 inline-flex text-sm font-medium text-[var(--color-accent)] hover:underline"
                  >
                    詳細
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
