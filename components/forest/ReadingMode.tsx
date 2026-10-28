"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FiArrowLeft,
  FiSettings,
  FiPlus,
  FiRotateCcw,
  FiMap,
  FiRefreshCw,
} from "react-icons/fi";
import { apiUrl } from "@/lib/api";
import {
  effectiveReadPages,
  eraLabel,
  genres,
  growthStage,
  nextPage,
  regionLabel,
  treeHeightMeters,
  treeSpecies,
  type Classification,
  type ForestEntry,
} from "@/lib/literature-forest/model";
import ClassificationForm from "./ClassificationForm";
import TreeIllustration from "./TreeIllustration";
import styles from "./forest.module.css";

type Operation = {
  operationId: string;
  readingStatusId: string;
  delta: number;
};
export default function ReadingMode({
  bookId,
  initialEditing = false,
}: {
  bookId: string;
  initialEditing?: boolean;
}) {
  const { data: session, status } = useSession();
  if (status === "loading")
    return <p role="status" className="p-8 text-center">読書の森を読み込み中...</p>;
  if (!session?.user?.id)
    return <div className="space-y-3 p-6"><p>ログインが必要です</p><Link href="/login">ログイン</Link></div>;
  return <ReadingModeContent key={`${session.user.id}:${bookId}`} bookId={bookId} initialEditing={initialEditing} />;
}

function ReadingModeContent({ bookId, initialEditing }: { bookId: string; initialEditing: boolean }) {
  const [tree, setTree] = useState<ForestEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [editing, setEditing] = useState(initialEditing);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pending, setPending] = useState<Operation | null>(null);
  const [optimisticDelta, setOptimisticDelta] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [effects, setEffects] = useState(true);
  const [haptics, setHaptics] = useState(false);
  const [saved, setSaved] = useState(false);
  const [totalInput, setTotalInput] = useState("");
  const readRequest = useRef<{ version: number; controller?: AbortController }>({ version: 0 });
  const cancelRead = useCallback(() => {
    readRequest.current.controller?.abort();
    readRequest.current.version += 1;
  }, []);
  const clearUnavailable = useCallback((status: number) => {
    if (![401, 403, 404].includes(status)) return;
    setTree(null);
    setPending(null);
    setOptimisticDelta(0);
    setTotalInput("");
    setEditing(false);
    setSaved(false);
    setNeedsLogin(status === 401);
  }, []);
  const endpoint = `/api/me/literature-forest/${encodeURIComponent(bookId)}`;
  const load = useCallback(async () => {
    cancelRead();
    const version = readRequest.current.version;
    const controller = new AbortController();
    readRequest.current.controller = controller;
    try {
      const response = await fetch(apiUrl(endpoint), { cache: "no-store", signal: controller.signal });
      if (version !== readRequest.current.version) return false;
      clearUnavailable(response.status);
      const data = await response.json();
      if (version !== readRequest.current.version) return false;
      setNeedsLogin(response.status === 401);
      if (!response.ok) throw new Error(data.error || "読み込めませんでした");
      setTree(data.tree);
      setTotalInput(data.tree.totalPages ? String(data.tree.totalPages) : "");
      setPending(null);
      try {
        const raw = sessionStorage.getItem(
          `forest:pending:${data.tree.readingStatusId}`,
        );
        if (raw) {
          const op: Operation = JSON.parse(raw);
          if (
            op.readingStatusId === data.tree.readingStatusId &&
            (op.delta === 1 || op.delta === -1)
          )
            setPending(op);
        }
      } catch {
        /* Storage is optional; the server's progress remains authoritative. */
      }
      setError("");
      return true;
    } catch (error) {
      if (controller.signal.aborted || version !== readRequest.current.version) return false;
      setError(error instanceof Error ? error.message : "読み込めませんでした");
      return false;
    } finally {
      if (version === readRequest.current.version) setLoading(false);
    }
  }, [endpoint, cancelRead, clearUnavailable]);
  useEffect(() => {
    // Fetch the existing record on mount; there is no derived-state synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return cancelRead;
  }, [load, cancelRead]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    if (busy || pending) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, pending]);
  useEffect(() => {
    const refresh = () => {
      if (!busyRef.current && !pending) void load();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load, pending]);

  const saveClassification = async (classification: Classification) => {
    if (busyRef.current || pending) throw new Error("保存中の操作を確認してください");
    busyRef.current = true;
    setBusy(true);
    setSaved(false);
    cancelRead();
    try {
      const response = await fetch(apiUrl(endpoint), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classification),
      });
      clearUnavailable(response.status);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "分類を保存できませんでした");
        throw new Error(data.error || "分類を保存できませんでした");
      }
      setTree(data.tree);
      setEditing(false);
      setError("");
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "分類を保存できませんでした");
      throw error;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const changePage = async (delta: number, retry?: Operation) => {
    if (!tree || busyRef.current || (pending && !retry)) return;
    let op: Operation;
    try {
      if (!retry) nextPage(tree, delta);
      op = retry || {
        operationId: crypto.randomUUID(),
        readingStatusId: tree.readingStatusId,
        delta,
      };
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作を開始できません");
      return;
    }
    busyRef.current = true;
    cancelRead();
    setBusy(true);
    setError("");
    setSaved(false);
    setPending(op);
    setOptimisticDelta(retry ? 0 : delta);
    setPulse((n) => n + 1);
    try {
      sessionStorage.setItem(
        `forest:pending:${tree.readingStatusId}`,
        JSON.stringify(op),
      );
    } catch {
      /* Optional retry recovery. */
    }
    if (
      haptics &&
      effects &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      navigator.vibrate?.(15);
    try {
      const response = await fetch(apiUrl(`${endpoint}/progress`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op),
        signal: AbortSignal.timeout(15000),
      });
      clearUnavailable(response.status);
      const data = await response.json();
      if (!response.ok) {
        // 4xx is a definitive refusal. 5xx/network failures may have committed: retry the same ID.
        if (response.status < 500) {
          setPending(null);
          try {
            sessionStorage.removeItem(`forest:pending:${tree.readingStatusId}`);
          } catch {
            /* Optional storage. */
          }
          await load();
        }
        throw new Error(data.error || "保存を確認できませんでした");
      }
      setTree(data.tree);
      setPending(null);
      setSaved(true);
      try {
        sessionStorage.removeItem(`forest:pending:${tree.readingStatusId}`);
      } catch {
        /* Optional storage. */
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "保存を確認できませんでした",
      );
    } finally {
      setOptimisticDelta(0);
      setBusy(false);
      busyRef.current = false;
    }
  };
  const saveTotal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tree || busyRef.current || pending) return;
    busyRef.current = true;
    cancelRead();
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch(
        apiUrl(`/api/me/readings/${tree.readingStatusId}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalPages: Number(totalInput) }),
        },
      );
      clearUnavailable(response.status);
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) await load();
        throw new Error(data.error || "ページ数を更新できませんでした");
      }
      setSaved(await load());
    } catch (error) {
      setError(error instanceof Error ? error.message : "更新できませんでした");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className="p-8 text-center" role="status">
        読書の森を読み込み中...
      </div>
    );
  if (!tree)
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <p role="alert">{error}</p>
        {needsLogin ? (
          <Link href="/login">ログイン</Link>
        ) : (
          <button type="button" onClick={() => void load()}>
            再読み込み
          </button>
        )}
        <Link className="block" href={`/books/${bookId}`}>
          本の詳細に戻る
        </Link>
      </div>
    );
  const displayed = {
    ...tree,
    currentPage: tree.currentPage + optimisticDelta,
  };
  const pages = effectiveReadPages(displayed);
  const classification = tree.classification;
  const genre = genres.find((g) => g.id === classification?.mainGenreId);
  const showSettings =
    editing || (!classification && tree.status === "READING");
  const blocked = busy || !!pending;
  return (
    <div className={`${styles.surface} mx-auto max-w-3xl px-4 py-6`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-4">
        <Link
          href={`/books/${bookId}`}
          aria-disabled={blocked}
          onClick={(e) => {
            if (blocked) e.preventDefault();
          }}
          className="inline-flex min-h-11 items-center gap-2 text-sm"
        >
          <FiArrowLeft aria-hidden />
          本を閉じる
        </Link>
        <Link
          href={`/mypage/forest/${classification?.literatureScope || "world"}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm"
          onClick={(e) => {
            if (blocked) e.preventDefault();
          }}
          aria-disabled={blocked}
        >
          <FiMap aria-hidden />
          読書マップ
        </Link>
      </header>
      <div className="py-5">
        <h1 className="break-words font-serif text-xl font-semibold">
          {tree.title}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{tree.author}</p>
        <p className="mt-2 text-xs text-gray-600">
          {tree.totalPages
            ? `総ページ数 ${tree.totalPages}ページ（自分用）`
            : "総ページ数未設定"}
        </p>
      </div>
      {showSettings ? (
        <ClassificationForm
          initial={classification}
          onSave={saveClassification}
          onCancel={() => {
            if (classification) setEditing(false);
            else window.location.assign(`/books/${encodeURIComponent(bookId)}`);
          }}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 pb-3">
            <div className="text-sm">
              <p>
                {regionLabel(classification)}
                {classification && ` · ${eraLabel(classification)}`}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {genre?.label || "ジャンル未設定"}
                {genre && ` · ${treeSpecies[genre.treeStyleId]}`}
              </p>
            </div>
            <button
              type="button"
              className={styles.button}
              title="地域・年代・ジャンル設定"
              aria-label="地域・年代・ジャンル設定"
              disabled={blocked}
              onClick={() => setEditing(true)}
            >
              <FiSettings />
            </button>
          </div>
          <div
            className={`${styles.scene} flex h-64 items-center justify-center sm:h-80`}
          >
            <div className="h-full w-64 sm:w-72" key={pulse}>
              <TreeIllustration
                pages={pages}
                classification={classification}
                pulse={effects && pulse > 0}
              />
            </div>
          </div>
          <div
            className="py-5 text-center"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="text-2xl font-semibold tabular-nums">
              {pages === null
                ? "ページ数未設定"
                : `${pages} / ${tree.totalPages || "未設定"}`}
              <span className="ml-2 text-sm font-normal">
                {pages !== null && "ページ"}
              </span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {tree.status === "COMPLETED"
                ? "読了"
                : tree.totalPages
                  ? `${Math.floor(((pages || 0) / tree.totalPages) * 100)}%`
                  : "読書中"}{" "}
              · {growthStage(pages)}
              {pages !== null &&
                pages > 0 &&
                ` · ${treeHeightMeters(pages).toFixed(2)}m`}
            </p>
          </div>
          {tree.status === "READING" && (
            <div className="mx-auto grid max-w-md gap-2">
              <button
                type="button"
                className={`${styles.button} ${styles.primary} min-h-16 text-lg font-medium`}
                disabled={
                  blocked || tree.currentPage >= (tree.totalPages || 100000)
                }
                onClick={() => void changePage(1)}
              >
                <FiPlus aria-hidden />
                1ページ読んだ
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={blocked || tree.currentPage <= 0}
                onClick={() => void changePage(-1)}
              >
                <FiRotateCcw aria-hidden />
                1ページ戻す
              </button>
            </div>
          )}
          <div className="min-h-10 py-3 text-center text-sm" role="status">
            {busy
              ? "保存中..."
              : saved
                ? "保存しました"
                : pending
                  ? "未確認の保存があります"
                  : ""}
          </div>
          {error && (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {pending && !busy && (
            <button
              type="button"
              className={styles.button}
              onClick={() => void changePage(pending.delta, pending)}
            >
              <FiRefreshCw aria-hidden />
              同じ操作を再試行
            </button>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {classification?.subgenreIds.map((id) => (
              <span className={styles.chip} key={id}>
                {genre?.groups
                  .flatMap((g) => g.subgenres)
                  .find((s) => s.id === id)?.label || id}
              </span>
            ))}
            {classification?.customGenreTags.map((tag) => (
              <span className={styles.chip} key={tag}>
                {tag}
              </span>
            ))}
          </div>
          <details
            open={pages === null ? true : undefined}
            className="mt-6 border-t border-emerald-100 pt-3"
          >
            <summary className="cursor-pointer py-2 text-sm">
              ページ数・演出設定
            </summary>
            <div className="mt-3 space-y-4">
              <form
                onSubmit={saveTotal}
                className="flex flex-wrap items-end gap-2"
              >
                <label className="grid gap-1 text-sm">
                  総ページ数（自分用）
                  <input
                    type="number"
                    min={Math.max(1, tree.currentPage)}
                    max={100000}
                    required
                    value={totalInput}
                    disabled={blocked}
                    onChange={(e) => setTotalInput(e.target.value)}
                    className={`${styles.control} w-36`}
                  />
                </label>
                <button className={styles.button} disabled={blocked}>
                  更新
                </button>
              </form>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={effects}
                  onChange={(e) => setEffects(e.target.checked)}
                />
                成長アニメーション
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={haptics}
                  onChange={(e) => setHaptics(e.target.checked)}
                />
                タップ時の振動
              </label>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
