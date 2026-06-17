import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AdminSuspensionAppealsPageProps = {
  searchParams: Promise<{
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "pending", label: "未対応" },
  { value: "reviewing", label: "確認中" },
  { value: "resolved", label: "確認済み" },
  { value: "rejected", label: "却下" },
];

const statusLabels: Record<string, string> = {
  pending: "未対応",
  reviewing: "確認中",
  resolved: "確認済み",
  rejected: "却下",
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function truncate(value: string, maxLength = 120) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildHref(params: { status: string; page: number; pageSize: number }) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page !== 1) search.set("page", String(params.page));
  if (params.pageSize !== DEFAULT_PAGE_SIZE) {
    search.set("pageSize", String(params.pageSize));
  }
  const query = search.toString();
  return query ? `/admin/suspension-appeals?${query}` : "/admin/suspension-appeals";
}

function UserLabel({
  user,
  fallback,
}: {
  user: { id: string; name: string; handle: string | null } | null;
  fallback: string;
}) {
  if (!user) return <span className="text-gray-400">{fallback}</span>;
  return (
    <span>
      {user.name}
      {user.handle ? (
        <span className="ml-1 font-mono text-xs text-gray-500">@{user.handle}</span>
      ) : null}
    </span>
  );
}

export default async function AdminSuspensionAppealsPage({
  searchParams,
}: AdminSuspensionAppealsPageProps) {
  const params = await searchParams;
  const status = params.status?.trim() || "";
  const page = parsePositiveInt(params.page, 1);
  const pageSize = Math.min(parsePositiveInt(params.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const where: Prisma.SuspensionAppealWhereInput = {};
  if (status) where.status = status;

  const [total, appeals] = await Promise.all([
    prisma.suspensionAppeal.count({ where }),
    prisma.suspensionAppeal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            handle: true,
            accountStatus: true,
            deactivatedAt: true,
          },
        },
        adminUser: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="border-b pb-5">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="hover:text-amber-700 hover:underline">
            管理画面
          </Link>
          <span className="mx-2">/</span>
          停止異議申し立て
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">停止異議申し立て</h1>
        <p className="mt-2 text-sm text-gray-500">
          利用停止中ユーザーから送信された異議申し立てを確認します。ここでは停止解除は行いません。
        </p>
      </div>

      <form className="mt-6 rounded-lg border bg-white p-4 shadow-sm" action="/admin/suspension-appeals">
        <div className="grid gap-3 md:grid-cols-[180px_140px_auto]">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">ステータス</span>
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
              defaultValue={String(pageSize)}
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
              href="/admin/suspension-appeals"
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
            {total}件中 {appeals.length}件を表示
          </p>
          <p className="text-xs text-gray-400">メールアドレスや停止理由は表示しません。</p>
        </div>

        {appeals.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            異議申し立てはありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">日時</th>
                  <th className="px-4 py-3">status</th>
                  <th className="px-4 py-3">ユーザー</th>
                  <th className="px-4 py-3">申し立て内容</th>
                  <th className="px-4 py-3">最終対応</th>
                  <th className="px-4 py-3">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {appeals.map((appeal) => (
                  <tr key={appeal.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDateTime(appeal.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {statusLabels[appeal.status] ?? appeal.status}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <UserLabel user={appeal.user} fallback="削除済みユーザー" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-md whitespace-pre-wrap break-words text-gray-700">
                        {truncate(appeal.message)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <UserLabel user={appeal.adminUser} fallback="-" />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/suspension-appeals/${appeal.id}`}
                        className="text-sm font-semibold text-amber-700 hover:underline"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <nav className="mt-5 flex items-center justify-between gap-3">
        <Link
          href={buildHref({ status, pageSize, page: Math.max(1, page - 1) })}
          aria-disabled={page <= 1}
          className={`rounded-md border px-4 py-2 text-sm font-semibold ${
            page <= 1 ? "pointer-events-none text-gray-300" : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          前へ
        </Link>
        <p className="text-sm text-gray-500">
          {page} / {totalPages} ページ
        </p>
        <Link
          href={buildHref({ status, pageSize, page: Math.min(totalPages, page + 1) })}
          aria-disabled={page >= totalPages}
          className={`rounded-md border px-4 py-2 text-sm font-semibold ${
            page >= totalPages
              ? "pointer-events-none text-gray-300"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          次へ
        </Link>
      </nav>
    </main>
  );
}
