"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api";
import Link from "next/link";

interface WorkSummary {
  id: string;
  title: string;
  author: string;
  editions: Array<{ coverImageUrl: string | null }>;
}

interface Suggestion {
  id: string;
  score: number | null;
  reason: string | null;
  status: string;
  createdAt: string;
  sourceWork: WorkSummary;
  targetWork: WorkSummary;
  reporter: { id: string; name: string } | null;
}

export default function MergeSuggestionsAdminPage() {
  const { data: session } = useSession();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/merge-suggestions?status=${statusFilter}`));
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [statusFilter]);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    const confirmMsg = action === "approve"
      ? "この統合を実行しますか？元の作品は削除されます。"
      : "この報告を却下しますか？";
    if (!confirm(confirmMsg)) return;

    setProcessing(id);
    try {
      const res = await fetch(apiUrl(`/api/admin/merge-suggestions/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchSuggestions();
      } else {
        const data = await res.json();
        alert(data.error || "処理に失敗しました");
      }
    } finally {
      setProcessing(null);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">ログインが必要です</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">作品統合の管理</h1>
      <p className="mt-1 text-sm text-gray-500">
        ユーザーやシステムから報告された「同じ作品」の統合候補を確認できます
      </p>

      {/* フィルタ */}
      <div className="mt-4 flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded px-3 py-1 text-sm ${
              statusFilter === s
                ? "bg-amber-100 text-amber-700 font-medium"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {s === "pending" ? "未処理" : s === "approved" ? "承認済み" : "却下済み"}
          </button>
        ))}
      </div>

      {/* 一覧 */}
      {loading ? (
        <p className="mt-6 text-gray-400">読み込み中...</p>
      ) : suggestions.length === 0 ? (
        <p className="mt-6 text-gray-400">
          {statusFilter === "pending" ? "未処理の報告はありません" : "該当する報告はありません"}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-4">
                {/* Source Work */}
                <WorkCard work={s.sourceWork} label="統合元" />

                <div className="flex shrink-0 flex-col items-center justify-center self-center">
                  <span className="text-2xl text-gray-300">→</span>
                  {s.score != null && (
                    <span className="mt-1 text-xs text-gray-400">
                      スコア: {(s.score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Target Work */}
                <WorkCard work={s.targetWork} label="統合先" />
              </div>

              {/* メタ情報 */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-gray-500">
                {s.reporter && <span>報告者: {s.reporter.name}</span>}
                {s.reason && <span>理由: {s.reason}</span>}
                <span>{new Date(s.createdAt).toLocaleDateString("ja-JP")}</span>
              </div>

              {/* アクション */}
              {statusFilter === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleAction(s.id, "approve")}
                    disabled={processing === s.id}
                    className="rounded bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing === s.id ? "処理中..." : "統合を実行"}
                  </button>
                  <button
                    onClick={() => handleAction(s.id, "reject")}
                    disabled={processing === s.id}
                    className="rounded border px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    却下
                  </button>
                </div>
              )}

              {statusFilter !== "pending" && (
                <div className="mt-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs ${
                    s.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {s.status === "approved" ? "承認済み" : "却下済み"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkCard({ work, label }: { work: Suggestion["sourceWork"]; label: string }) {
  const cover = work.editions[0]?.coverImageUrl;
  return (
    <div className="flex flex-1 items-start gap-3">
      {cover ? (
        <img src={cover} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">?</div>
      )}
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <Link
          href={`/works/${work.id}`}
          className="text-sm font-medium text-gray-700 hover:text-amber-600"
        >
          {work.title}
        </Link>
        <p className="text-xs text-gray-500">{work.author}</p>
      </div>
    </div>
  );
}
