import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AuditLogsPageProps = {
  searchParams: Promise<{
    action?: string;
    targetType?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function metadataToText(value: Prisma.JsonValue | null) {
  if (!value) return "-";

  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 800 ? `${text.slice(0, 800)}...` : text;
  } catch {
    return "-";
  }
}

function buildHref(params: {
  action: string;
  targetType: string;
  pageSize: number;
  page: number;
}) {
  const search = new URLSearchParams();
  if (params.action) search.set("action", params.action);
  if (params.targetType) search.set("targetType", params.targetType);
  if (params.page !== 1) search.set("page", String(params.page));
  if (params.pageSize !== DEFAULT_PAGE_SIZE) {
    search.set("pageSize", String(params.pageSize));
  }
  const query = search.toString();
  return query ? `/admin/audit-logs?${query}` : "/admin/audit-logs";
}

export default async function AdminAuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const params = await searchParams;
  const action = params.action?.trim() || "";
  const targetType = params.targetType?.trim() || "";
  const page = parsePositiveInt(params.page, 1);
  const pageSize = Math.min(parsePositiveInt(params.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const where: Prisma.AdminAuditLogWhereInput = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;

  const [total, logs] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        targetUserId: true,
        reason: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        admin: {
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
          監査ログ
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">監査ログ</h1>
        <p className="mt-2 text-sm text-gray-500">
          管理者操作の履歴を読み取り専用で確認します。一般ユーザーには表示されません。
        </p>
      </div>

      <form className="mt-6 rounded-lg border bg-white p-4 shadow-sm" action="/admin/audit-logs">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">操作</span>
            <input
              name="action"
              defaultValue={action}
              placeholder="work.merge"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">対象種別</span>
            <input
              name="targetType"
              defaultValue={targetType}
              placeholder="Work"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
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
              href="/admin/audit-logs"
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
            {total}件中 {logs.length}件を表示
          </p>
          <p className="text-xs text-gray-400">
            metadata は必要最小限の補足情報だけを記録する前提です。
          </p>
        </div>

        {logs.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            監査ログはまだありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">日時</th>
                  <th className="px-4 py-3">管理者</th>
                  <th className="px-4 py-3">操作</th>
                  <th className="px-4 py-3">対象種別</th>
                  <th className="px-4 py-3">対象ID</th>
                  <th className="px-4 py-3">対象ユーザーID</th>
                  <th className="px-4 py-3">理由</th>
                  <th className="px-4 py-3">metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.admin ? (
                        <span>
                          {log.admin.name}
                          {log.admin.handle ? (
                            <span className="ml-1 font-mono text-xs text-gray-500">
                              @{log.admin.handle}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-gray-400">削除済み管理者</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{log.action}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {log.targetType}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {log.targetId || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {log.targetUserId || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{log.reason || "-"}</td>
                    <td className="px-4 py-3">
                      <pre className="max-w-md whitespace-pre-wrap break-words rounded bg-gray-50 p-2 text-xs text-gray-600">
                        {metadataToText(log.metadata)}
                      </pre>
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
          href={buildHref({
            action,
            targetType,
            pageSize,
            page: Math.max(1, page - 1),
          })}
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
          href={buildHref({
            action,
            targetType,
            pageSize,
            page: Math.min(totalPages, page + 1),
          })}
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
