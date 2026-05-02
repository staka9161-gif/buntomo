"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api";
import Link from "next/link";

interface Stats {
  works: number;
  editions: number;
  books_total: number;
  books_migrated: number;
  books_pending_migration: number;
  merge_suggestions: {
    pending: number;
    approved: number;
    rejected: number;
  };
  works_with_multiple_editions: number;
  translation_groups: number;
}

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/stats"));
        if (res.ok) {
          setStats(await res.json());
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">ログインが必要です</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">統計情報の取得に失敗しました</p>
      </div>
    );
  }

  const migrationPercent = stats.books_total > 0
    ? Math.round((stats.books_migrated / stats.books_total) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Work/Edition 管理ダッシュボード</h1>
      <p className="mt-1 text-sm text-gray-500">
        作品と版の分離状況を確認できます
      </p>

      {/* メイン統計 */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Work（作品）" value={stats.works} />
        <StatCard label="Edition（版）" value={stats.editions} />
        <StatCard label="複数版を持つ作品" value={stats.works_with_multiple_editions} />
        <StatCard label="翻訳グループ" value={stats.translation_groups} />
      </div>

      {/* 移行状況 */}
      <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">Book → Work 移行状況</h2>
        <div className="mt-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>移行済み: {stats.books_migrated} / {stats.books_total}</span>
            <span>{migrationPercent}%</span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${migrationPercent}%` }}
            />
          </div>
          {stats.books_pending_migration > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              未移行: {stats.books_pending_migration} 件
              （<code>npm run migrate:works:execute</code> で移行可能）
            </p>
          )}
        </div>
      </div>

      {/* MergeSuggestion */}
      <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">統合候補 (MergeSuggestion)</h2>
          <Link
            href="/admin/merge-suggestions"
            className="text-sm text-amber-600 hover:underline"
          >
            管理画面を開く →
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-amber-50 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.merge_suggestions.pending}</p>
            <p className="text-xs text-gray-500">未処理</p>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.merge_suggestions.approved}</p>
            <p className="text-xs text-gray-500">承認済み</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-2xl font-bold text-gray-400">{stats.merge_suggestions.rejected}</p>
            <p className="text-xs text-gray-500">却下済み</p>
          </div>
        </div>
      </div>

      {/* コマンドリファレンス */}
      <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700">運用コマンド</h2>
        <div className="mt-3 space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <code className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs">npm run migrate:works</code>
            <span>Book → Work+Edition 移行（dry-run）</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs">npm run migrate:works:execute</code>
            <span>Book → Work+Edition 移行（実行）</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs">npm run batch:matching</code>
            <span>Work 間バッチマッチング（dry-run）</span>
          </div>
          <div className="flex items-start gap-2">
            <code className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs">npm run batch:matching:execute</code>
            <span>Work 間バッチマッチング（実行: 自動統合+保留作成）</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm text-center">
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}
