import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminUsers, normalizeAdminUserStatus } from "@/lib/admin-users";

type AdminUsersPageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const statusOptions = [
  { value: "all", label: "すべて" },
  { value: "active", label: "利用中" },
  { value: "deactivated", label: "退会済み" },
  { value: "admin", label: "管理者" },
];

function formatDate(value: Date | string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function buildHref(params: {
  query: string;
  status: string;
  pageSize: number;
  page: number;
}) {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.status !== "all") search.set("status", params.status);
  if (params.page !== 1) search.set("page", String(params.page));
  if (params.pageSize !== 20) search.set("pageSize", String(params.pageSize));
  const queryString = search.toString();
  return queryString ? `/admin/users?${queryString}` : "/admin/users";
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const data = await getAdminUsers(params);
  const status = normalizeAdminUserStatus(params.status);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="border-b pb-5">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="hover:text-amber-700 hover:underline">
            管理者画面
          </Link>
          <span className="mx-2">/</span>
          利用者一覧
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">利用者一覧</h1>
        <p className="mt-2 text-sm text-gray-500">
          利用者の状態を確認するための読み取り専用一覧です。編集・削除・権限変更はできません。
        </p>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="総ユーザー数" value={data.summary.totalUsers} />
        <SummaryCard label="利用中" value={data.summary.activeUsers} />
        <SummaryCard label="退会済み" value={data.summary.deactivatedUsers} />
        <SummaryCard label="管理者" value={data.summary.adminUsers} />
      </section>

      <form className="mt-6 rounded-lg border bg-white p-4 shadow-sm" action="/admin/users">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_140px_auto]">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">検索</span>
            <input
              type="search"
              name="query"
              defaultValue={data.query}
              placeholder="表示名・handle・メール"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">状態</span>
            <select
              name="status"
              defaultValue={status}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">表示件数</span>
            <select
              name="pageSize"
              defaultValue={String(data.pageSize)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {[20, 30, 50].map((size) => (
                <option key={size} value={size}>
                  {size}件
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
            >
              絞り込む
            </button>
            <Link
              href="/admin/users"
              className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              解除
            </Link>
          </div>
        </div>
      </form>

      <section className="mt-5 rounded-lg border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <p className="text-sm text-gray-600">
            {data.total}件中 {data.users.length}件を表示
          </p>
          <p className="text-xs text-gray-400">
            メールアドレスは一覧上ではマスクしています。
          </p>
        </div>

        {data.users.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            該当する利用者はいません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">表示名</th>
                  <th className="px-4 py-3">handle</th>
                  <th className="px-4 py-3">メール</th>
                  <th className="px-4 py-3">権限</th>
                  <th className="px-4 py-3">メール確認</th>
                  <th className="px-4 py-3">公開</th>
                  <th className="px-4 py-3">状態</th>
                  <th className="px-4 py-3">読書記録</th>
                  <th className="px-4 py-3">友だち</th>
                  <th className="px-4 py-3">登録日</th>
                  <th className="px-4 py-3">更新日</th>
                  <th className="px-4 py-3">削除予定日</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.users.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/admin/users/${user.id}`} className="hover:text-amber-700 hover:underline">
                        {user.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {user.handle ? (
                        <Link href={`/admin/users/${user.id}`} className="hover:text-amber-700 hover:underline">
                          @{user.handle}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.maskedEmail}</td>
                    <td className="px-4 py-3">
                      {user.isAdmin ? <Badge tone="amber">管理者</Badge> : <Badge>一般</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {user.emailVerified ? <Badge tone="green">確認済み</Badge> : <Badge tone="gray">未確認</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {user.isPublic ? <Badge tone="green">公開</Badge> : <Badge tone="gray">非公開</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {user.deactivatedAt ? <Badge tone="red">退会済み</Badge> : <Badge tone="green">利用中</Badge>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">{user.readingCount}</td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">{user.friendCount}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(user.updatedAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(user.scheduledDeletionAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <nav className="mt-5 flex items-center justify-between gap-3">
        <Link
          href={buildHref({
            query: data.query,
            status: data.status,
            pageSize: data.pageSize,
            page: Math.max(1, data.page - 1),
          })}
          aria-disabled={data.page <= 1}
          className={`rounded-md border px-4 py-2 text-sm font-semibold ${
            data.page <= 1 ? "pointer-events-none text-gray-300" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          前へ
        </Link>
        <p className="text-sm text-gray-500">
          {data.page} / {data.totalPages} ページ
        </p>
        <Link
          href={buildHref({
            query: data.query,
            status: data.status,
            pageSize: data.pageSize,
            page: Math.min(data.totalPages, data.page + 1),
          })}
          aria-disabled={data.page >= data.totalPages}
          className={`rounded-md border px-4 py-2 text-sm font-semibold ${
            data.page >= data.totalPages ? "pointer-events-none text-gray-300" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          次へ
        </Link>
      </nav>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "green" | "red" | "amber";
}) {
  const className = {
    gray: "border-gray-200 bg-gray-50 text-gray-600",
    green: "border-green-200 bg-green-50 text-green-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  }[tone];

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}
