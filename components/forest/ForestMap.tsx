"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FiArrowLeft,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import { apiUrl } from "@/lib/api";
import {
  eras,
  eraFor,
  genres,
  regions,
  type ForestEntry,
} from "@/lib/literature-forest/model";
import ForestMapCanvas, { type ForestGeography } from "./ForestMapCanvas";
import ForestTimeline from "./ForestTimeline";
import ForestWorkDetails from "./ForestWorkDetails";
import {
  filterForest,
  sortForestByYear,
  type ForestScope,
} from "./forest-catalog";
import styles from "./forest.module.css";

export default function ForestMap({
  scope,
}: {
  scope: ForestScope;
}) {
  const { data: session, status } = useSession();
  if (status === "loading")
    return <p role="status" className="p-8 text-center">読書マップを読み込み中...</p>;
  if (!session?.user?.id)
    return <div className="space-y-3 p-6"><p>ログインが必要です</p><Link href="/login">ログイン</Link></div>;
  return <ForestMapContent key={`${session.user.id}:${scope}`} scope={scope} />;
}

function ForestMapContent({ scope }: { scope: ForestScope }) {
  const [trees, setTrees] = useState<ForestEntry[]>([]);
  const [map, setMap] = useState<ForestGeography | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [region, setRegion] = useState("");
  const [selected, setSelected] = useState("");
  const [mainGenre, setMainGenre] = useState("");
  const [subgenre, setSubgenre] = useState("");
  const [era, setEra] = useState("");
  const [query, setQuery] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const readRequest = useRef<{ version: number; controller?: AbortController }>({ version: 0 });
  const cancelRead = useCallback(() => {
    readRequest.current.controller?.abort();
    readRequest.current.version += 1;
  }, []);
  const load = useCallback(async () => {
    cancelRead();
    const version = readRequest.current.version;
    const controller = new AbortController();
    readRequest.current.controller = controller;
    try {
      const response = await fetch(apiUrl("/api/me/literature-forest"), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (version !== readRequest.current.version) return;
      setUnauthorized(response.status === 401);
      if ([401, 403, 404].includes(response.status)) {
        setTrees([]);
        setSelected("");
      }
      const data = await response.json();
      if (version !== readRequest.current.version) return;
      if (!response.ok)
        throw new Error(data.error || "森を読み込めませんでした");
      setTrees(data.trees);
      setError("");
      if (scope !== "unplaced") {
        const result = await fetch("/forest/" + scope + ".json", { signal: controller.signal });
        if (!result.ok) throw new Error("地図を読み込めませんでした");
        const geography = await result.json();
        if (version === readRequest.current.version) setMap(geography);
      }
    } catch (error) {
      if (controller.signal.aborted || version !== readRequest.current.version) return;
      setError(error instanceof Error ? error.message : "読み込めませんでした");
    } finally {
      if (version === readRequest.current.version) setLoading(false);
    }
  }, [scope, cancelRead]);
  useEffect(() => {
    // Filters reuse the same fetched forest.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return cancelRead;
  }, [load, cancelRead]);
  const filters = { scope, mainGenre, subgenre, era, query };
  const mapTrees = filterForest(trees, filters);
  const shown = sortForestByYear(
    filterForest(trees, { ...filters, region }),
    order,
  );
  const beforeEra = filterForest(trees, { ...filters, region, era: "" });
  const total = filterForest(trees, { scope });
  const active =
    shown.find((tree) => tree.bookId === selected) || shown[0] || null;
  const genre = genres.find((g) => g.id === mainGenre);
  const counts = new Map<string, number>();
  mapTrees.forEach((tree) => {
    const c = tree.classification;
    const code = c?.countryCode || c?.prefectureCode;
    if (code) counts.set(code, (counts.get(code) || 0) + 1);
  });
  const eraCounts = new Map<string, number>();
  beforeEra.forEach((tree) => {
    const id = eraFor(tree.classification)?.id || "unclassified";
    eraCounts.set(id, (eraCounts.get(id) || 0) + 1);
  });
  const selectTree = (id: string) => {
    setSelected(id);
    if (window.matchMedia("(max-width: 1023px)").matches)
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({
          block: "nearest",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      });
  };
  const changeRegion = (code: string) => {
    setRegion(code);
    setSelected("");
  };
  const filtered = !!(region || query || mainGenre || subgenre || era);
  const clear = () => {
    setRegion("");
    setQuery("");
    setMainGenre("");
    setSubgenre("");
    setEra("");
    setSelected("");
  };
  const title =
    scope === "japan"
      ? "日本の読書マップ"
      : scope === "world"
        ? "世界の読書マップ"
        : "地域未設定の本";
  return (
    <div className={styles.surface + " mx-auto max-w-7xl px-4 py-6"}>
      <Link
        href="/mypage"
        className="inline-flex min-h-11 items-center gap-2 text-sm"
      >
        <FiArrowLeft aria-hidden />
        マイページ
      </Link>
      <header className="my-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-xs text-gray-500">
            {total.length}冊 ·{" "}
            {
              new Set(
                total
                  .map(
                    (t) =>
                      t.classification?.countryCode ||
                      t.classification?.prefectureCode,
                  )
                  .filter(Boolean),
              ).size
            }
            地域
          </p>
        </div>
        <button
          type="button"
          className={styles.button}
          title="最新の森を読み込む"
          aria-label="最新の森を読み込む"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          <FiRefreshCw />
        </button>
      </header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#d3dfd6] pb-4">
        <nav className="flex flex-wrap gap-2" aria-label="読書マップの地域">
          {(
            [
              ["japan", "日本"],
              ["world", "世界"],
              ["unplaced", "未配置"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={`/mypage/forest/${value}`}
              aria-current={scope === value ? "page" : undefined}
              className={
                styles.button + (scope === value ? " " + styles.primary : "")
              }
            >
              {label}
              {value === "unplaced" &&
                " " + trees.filter((t) => !t.classification).length}
            </Link>
          ))}
        </nav>
      </div>
      {loading ? (
        <p role="status" className="py-16 text-center">
          読書マップを読み込み中...
        </p>
      ) : error ? (
        <div role="alert" className="space-y-3 py-8">
          <p>{error}</p>
          {unauthorized && (
            <Link href="/login" className={styles.button}>
              ログイン
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid w-full min-w-0 gap-1 text-xs sm:w-auto sm:flex-1">
              作品・著者・地域・タグ
              <input
                type="search"
                className={styles.control}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {scope !== "unplaced" && (
              <label className="grid max-w-full gap-1 text-xs">
                {scope === "japan" ? "都道府県" : "国・地域"}
                <select
                  className={styles.control + " w-44 sm:w-52"}
                  value={region}
                  onChange={(e) => changeRegion(e.target.value)}
                >
                  <option value="">すべての地域</option>
                  {regions[scope].map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}（{counts.get(r.code) || 0}本）
                    </option>
                  ))}
                </select>
              </label>
            )}
            {filtered && (
              <button type="button" className={styles.button} onClick={clear}>
                <FiX aria-hidden />
                条件クリア
              </button>
            )}
          </div>
          <details className="mt-3 border-b border-[#d8e2da] py-2">
            <summary className="cursor-pointer py-2 text-xs">
              ジャンル{(mainGenre || subgenre) && "（絞り込み中）"}
            </summary>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs">
                大ジャンル
                <select
                  className={styles.control}
                  value={mainGenre}
                  onChange={(e) => {
                    setMainGenre(e.target.value);
                    setSubgenre("");
                  }}
                >
                  <option value="">すべて</option>
                  {genres.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs">
                サブジャンル
                <select
                  className={styles.control}
                  disabled={!genre}
                  value={subgenre}
                  onChange={(e) => setSubgenre(e.target.value)}
                >
                  <option value="">すべて</option>
                  {genre?.groups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.subgenres.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <div
            className={`${styles.atlasWorkspace} mt-5`}
            style={scope === "unplaced" ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}
          >
            {scope !== "unplaced" && (
              <section className={styles.atlasPrimary} aria-label="読書マップ">
              {map && (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-serif text-lg font-medium">
                      {region
                        ? regions[scope].find((r) => r.code === region)?.label + "の森"
                        : "読書の森"}
                    </h2>
                    {region && (
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => changeRegion("")}
                      >
                        <FiArrowLeft aria-hidden />
                        地図全体
                      </button>
                    )}
                  </div>
                  <ForestMapCanvas
                    geography={map}
                    scope={scope}
                    trees={mapTrees}
                    region={region}
                    selected={active?.bookId || ""}
                    onRegionChange={changeRegion}
                    onSelect={selectTree}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    地図:{" "}
                    <a
                      className="underline"
                      href="https://www.naturalearthdata.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Natural Earth
                    </a>{" "}
                    ·{" "}
                    <a className="underline" href="/forest/ATTRIBUTION.md">
                      出典・ライセンス
                    </a>
                  </p>
                </>
              )}
              </section>
            )}
            <aside
              ref={detailRef}
              className={styles.atlasAside}
              aria-label={active ? active.title + "の詳細" : "作品の詳細"}
            >
              <ForestWorkDetails tree={active} />
              {active && (
                <a
                  href="#reading-timeline"
                  className="inline-flex min-h-11 items-center px-3 text-xs underline"
                >
                  読書年表へ
                </a>
              )}
            </aside>
          </div>
          <section
            id="reading-timeline"
            className="mt-8 border-t border-[#d8e2da] pt-5"
            aria-labelledby="reading-timeline-heading"
          >
            <div
              className={styles.eraSummary}
              role="group"
              aria-label="年代で絞り込み"
            >
              {[
                ...eras,
                ...(eraCounts.has("unclassified")
                  ? [{ id: "unclassified", label: "年代未設定", color: "#83918a" }]
                  : []),
              ].map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={styles.eraFilter}
                  style={{ "--era-color": e.color } as React.CSSProperties}
                  aria-pressed={era === e.id}
                  onClick={() => setEra(era === e.id ? "" : e.id)}
                >
                  <span>{e.label}</span>
                  <strong>{eraCounts.get(e.id) || 0}</strong>
                </button>
              ))}
            </div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="reading-timeline-heading" className="font-serif text-xl font-medium">
                  読書年表
                </h2>
                <p className="mt-2 text-xs text-gray-500" role="status">
                  {shown.length} / {total.length}冊
                </p>
              </div>
              <label className="grid gap-1 text-xs">
                年代順
                <select
                  className={styles.control}
                  value={order}
                  onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
                >
                  <option value="asc">古い年代から</option>
                  <option value="desc">新しい年代から</option>
                </select>
              </label>
            </div>
            {shown.length ? (
              <ForestTimeline
                trees={shown}
                selected={active?.bookId || ""}
                onSelect={selectTree}
              />
            ) : (
              <div className="space-y-3 py-12 text-sm text-gray-600">
                <p>
                  {total.length === 0 ? "まだ本がありません。" : "該当する本はありません。"}
                </p>
                <Link href="/mypage/reading" className="underline">
                  読みかけの本へ
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
