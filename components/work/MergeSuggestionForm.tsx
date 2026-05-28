"use client";

import { useState, useCallback } from "react";
import { apiUrl } from "@/lib/api";

interface WorkResult {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
}

interface MergeSuggestionFormProps {
  sourceWorkId: string;
  sourceWorkTitle: string;
  isLoggedIn: boolean;
}

export default function MergeSuggestionForm({
  sourceWorkId,
  sourceWorkTitle,
  isLoggedIn,
}: MergeSuggestionFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedWork, setSelectedWork] = useState<WorkResult | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(apiUrl(`/api/works/search?q=${encodeURIComponent(q)}`));
      if (res.ok) {
        const data = await res.json();
        // 自分自身を除外
        setResults(data.works.filter((w: WorkResult) => w.id !== sourceWorkId));
      }
    } finally {
      setSearching(false);
    }
  }, [sourceWorkId]);

  const handleSearch = (value: string) => {
    setQuery(value);
    setSelectedWork(null);
    // debounce 的に 300ms 後に検索
    const timer = setTimeout(() => search(value), 300);
    return () => clearTimeout(timer);
  };

  const handleSubmit = async () => {
    if (!selectedWork) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/works/${sourceWorkId}/merge-suggestions`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_work_id: selectedWork.id,
          reason: reason || null,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "送信に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoggedIn) return null;

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        報告を送信しました。管理者が確認します。
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-gray-400 hover:text-amber-600"
      >
        同じ作品を見つけた場合は報告する
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">
        「{sourceWorkTitle}」と同じ作品を報告
      </h3>

      {/* 検索 */}
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="作品名または著者名で検索..."
        className="w-full rounded border px-3 py-2 text-sm"
      />

      {/* 検索結果 */}
      {searching && <p className="mt-2 text-xs text-gray-400">検索中...</p>}
      {results.length > 0 && !selectedWork && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded border bg-white">
          {results.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                setSelectedWork(w);
                setResults([]);
              }}
              className="flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm hover:bg-amber-50 last:border-b-0"
            >
              {w.coverImageUrl ? (
                <img src={w.coverImageUrl} alt="" className="h-10 w-7 rounded object-cover" onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = "none"; el.nextElementSibling?.classList.remove("hidden"); }} />
              ) : null}
              <div className={`flex h-10 w-7 items-center justify-center rounded bg-gray-100 text-xs text-gray-400 ${w.coverImageUrl ? "hidden" : ""}`}>?</div>
              <div>
                <p className="font-medium text-gray-700">{w.title}</p>
                <p className="text-xs text-gray-500">{w.author}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 選択済み */}
      {selectedWork && (
        <div className="mt-2 flex items-center gap-3 rounded border bg-amber-50 p-2">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">{selectedWork.title}</p>
            <p className="text-xs text-gray-500">{selectedWork.author}</p>
          </div>
          <button
            onClick={() => setSelectedWork(null)}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            変更
          </button>
        </div>
      )}

      {/* 理由（任意） */}
      {selectedWork && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="理由（任意）: 例「同じ本の文庫版です」"
          className="mt-2 w-full rounded border px-3 py-2 text-sm"
          rows={2}
        />
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {/* ボタン */}
      <div className="mt-3 flex gap-2">
        {selectedWork && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? "送信中..." : "報告する"}
          </button>
        )}
        <button
          onClick={() => {
            setIsOpen(false);
            setQuery("");
            setResults([]);
            setSelectedWork(null);
            setReason("");
            setError(null);
          }}
          className="rounded px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
