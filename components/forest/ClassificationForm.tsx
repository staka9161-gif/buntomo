"use client";

import { useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import {
  eraFor,
  eraLabel,
  genres,
  matchesSubgenre,
  parseClassification,
  regions,
  literaryYear,
  treeSpecies,
  type Classification,
} from "@/lib/literature-forest/model";
import styles from "./forest.module.css";
import TreeIllustration from "./TreeIllustration";

export function changeClassificationScope(
  draft: Classification,
  scope: Classification["literatureScope"],
): Classification {
  return draft.literatureScope === scope
    ? draft
    : { ...draft, literatureScope: scope, countryCode: null, prefectureCode: null };
}

export default function ClassificationForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Classification | null;
  onSave: (value: Classification) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Classification>(
    initial || {
      literatureScope: "japan",
      prefectureCode: null,
      countryCode: null,
      era: "",
      mainGenreId: "",
      subgenreIds: [],
      customGenreTags: [],
    },
  );
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [pendingGenre, setPendingGenre] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [yearPeriod, setYearPeriod] = useState(
    (literaryYear(initial?.era || "") ?? 0) < 0 ? "bce" : "ce",
  );
  const year = literaryYear(draft.era);
  const setYear = (value: string, period = yearPeriod) => {
    setDraft({
      ...draft,
      era: value ? `${period === "bce" ? "-" : ""}${value}` : "",
    });
  };
  const genre = genres.find((g) => g.id === draft.mainGenreId);
  const subgenres = genre?.groups.flatMap((g) => g.subgenres) || [];
  const changeGenre = (id: string) => {
    if (draft.subgenreIds.length) setPendingGenre(id);
    else setDraft({ ...draft, mainGenreId: id });
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || pendingGenre !== null) return;
    setSaving(true);
    setError("");
    try {
      await onSave(parseClassification(draft));
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <h2 className="text-lg font-semibold">地域・年代・ジャンル設定</h2>
      <fieldset disabled={saving} className="space-y-5">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="地域の区分"
        >
          {(
            [
              ["japan", "日本"],
              ["world", "世界"],
            ] as const
          ).map(([scope, label]) => (
            <button
              type="button"
              key={scope}
              aria-pressed={draft.literatureScope === scope}
              className={`${styles.button} ${draft.literatureScope === scope ? styles.primary : ""}`}
              onClick={() => setDraft(changeClassificationScope(draft, scope))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            {draft.literatureScope === "japan" ? "都道府県" : "国・地域"}
            <select
              required
              className={styles.control}
              value={
                draft.literatureScope === "japan"
                  ? draft.prefectureCode || ""
                  : draft.countryCode || ""
              }
              onChange={(e) =>
                setDraft({
                  ...draft,
                  [draft.literatureScope === "japan"
                    ? "prefectureCode"
                    : "countryCode"]: e.target.value,
                })
              }
            >
              <option value="">選択してください</option>
              {regions[draft.literatureScope].map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="min-w-0 space-y-1">
            <legend className="text-sm">本の年代</legend>
            <div className="flex items-center gap-2">
              <select
                aria-label="紀元"
                className={`${styles.control} shrink-0`}
                value={yearPeriod}
                onChange={(e) => {
                  setYearPeriod(e.target.value);
                  if (year !== null)
                    setYear(String(Math.abs(year)), e.target.value);
                }}
              >
                <option value="ce">西暦</option>
                <option value="bce">紀元前</option>
              </select>
              <input
                aria-label="本の年代（年）"
                type="number"
                inputMode="numeric"
                step={1}
                min={1}
                max={9999}
                required={
                  !initial?.era ||
                  literaryYear(initial.era) !== null ||
                  !draft.era
                }
                value={year === null ? "" : Math.abs(year)}
                onChange={(e) => setYear(e.target.value)}
                className={`${styles.control} min-w-0 w-full`}
                placeholder="例: 1948"
              />
              <span className="text-sm">年</span>
            </div>
            <p className="text-xs text-gray-500">{eraLabel(draft)}</p>
          </fieldset>
        </div>
        <label className="grid gap-1 text-sm">
          大ジャンル
          <select
            required
            className={styles.control}
            value={draft.mainGenreId}
            onChange={(e) => changeGenre(e.target.value)}
          >
            <option value="">選択してください</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        {genre && (
          <figure className="flex items-center gap-4 border-y border-emerald-100 py-3">
            <div className="h-32 w-28 shrink-0">
              <TreeIllustration pages={200} classification={draft} />
            </div>
            <figcaption className="min-w-0 space-y-2 text-sm">
              <p className="font-medium">樹形・葉色</p>
              <p>{treeSpecies[genre.treeStyleId]}</p>
              <p className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: eraFor(draft)?.color || "#749881" }}
                />
                {eraLabel(draft)}
              </p>
            </figcaption>
          </figure>
        )}
        {pendingGenre !== null && (
          <div
            role="alert"
            className="border-l-4 border-amber-500 bg-amber-50 p-3 text-sm"
          >
            <p>
              大ジャンルを変更すると、選択済みのサブジャンルが解除されます。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  setDraft({
                    ...draft,
                    mainGenreId: pendingGenre,
                    subgenreIds: [],
                  });
                  setPendingGenre(null);
                  setQuery("");
                }}
              >
                変更する
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => setPendingGenre(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
        {genre && (
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">
              サブジャンル（複数選択・任意）
            </legend>
            {draft.subgenreIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {draft.subgenreIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.chip} min-h-9`}
                    aria-label={`${subgenres.find((s) => s.id === id)?.label}を解除`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        subgenreIds: draft.subgenreIds.filter((s) => s !== id),
                      })
                    }
                  >
                    {subgenres.find((s) => s.id === id)?.label}
                    <FiX aria-hidden />
                  </button>
                ))}
              </div>
            )}
            <label className="grid gap-1 text-sm">
              サブジャンルを検索
              <input
                type="search"
                className={styles.control}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="旅、暮らし、仕事など"
              />
            </label>
            <div className="max-h-72 overflow-y-auto overscroll-contain border-y border-emerald-100">
              {genre.groups.map((group) => {
                const visible = group.subgenres.filter((s) =>
                  matchesSubgenre(s, query),
                );
                if (!visible.length) return null;
                return (
                  <details
                    key={`${genre.id}:${group.label}:${!!query}`}
                    open={!!query || genre.groups.length === 1}
                    className="border-b border-emerald-100 py-2"
                  >
                    <summary className="cursor-pointer py-2 text-sm font-medium">
                      {group.label}{" "}
                      <span className="text-xs font-normal text-gray-500">
                        {visible.length}
                      </span>
                    </summary>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {visible.map((s) => (
                        <label
                          key={s.id}
                          className="flex min-h-10 cursor-pointer items-center gap-2 px-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={draft.subgenreIds.includes(s.id)}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                subgenreIds: e.target.checked
                                  ? [...draft.subgenreIds, s.id]
                                  : draft.subgenreIds.filter(
                                      (id) => id !== s.id,
                                    ),
                              })
                            }
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </details>
                );
              })}
              {!subgenres.some((s) => matchesSubgenre(s, query)) && (
                <p className="p-3 text-sm text-gray-500">
                  該当するサブジャンルはありません
                </p>
              )}
            </div>
          </fieldset>
        )}
        <div className="space-y-2">
          <label className="grid gap-1 text-sm">
            自由タグ（任意）
            <input
              className={styles.control}
              value={custom}
              maxLength={50}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </label>
          <button
            className={styles.button}
            type="button"
            disabled={!custom.trim() || draft.customGenreTags.length >= 30}
            onClick={() => {
              setDraft({
                ...draft,
                customGenreTags: [
                  ...new Set([...draft.customGenreTags, custom.trim()]),
                ],
              });
              setCustom("");
            }}
          >
            タグを追加
          </button>
          <div className="flex flex-wrap gap-2">
            {draft.customGenreTags.map((tag) => (
              <button
                type="button"
                key={tag}
                className={`${styles.chip} min-h-9`}
                aria-label={`${tag}を解除`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    customGenreTags: draft.customGenreTags.filter(
                      (t) => t !== tag,
                    ),
                  })
                }
              >
                {tag}
                <FiX aria-hidden />
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className={`${styles.button} ${styles.primary}`}
            disabled={pendingGenre !== null}
          >
            <FiCheck aria-hidden />
            {saving ? "保存中..." : "設定を保存"}
          </button>
          <button type="button" className={styles.button} onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </fieldset>
    </form>
  );
}
