import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type AuditLogsPageProps = {
  searchParams: Promise<{
    action?: string;
    targetType?: string;
    adminUserId?: string;
    targetUserId?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const SENSITIVE_METADATA_KEYS = [
  "content",
  "body",
  "message",
  "text",
  "dm",
  "email",
  "token",
  "password",
];
const actionOptions = [
  "report.updateStatus",
  "user.suspend",
  "user.unsuspend",
  "mergeSuggestion.approve",
  "mergeSuggestion.reject",
  "work.merge",
  "work.split",
];
const targetTypeOptions = ["Report", "User", "Work", "MergeSuggestion"];
const actionLabels: Record<string, string> = {
  "report.updateStatus": "通報ステータス変更",
  "user.suspend": "アカウント停止",
  "user.unsuspend": "アカウント停止解除",
  "work.merge": "作品統合",
  "work.split": "作品分割",
  "mergeSuggestion.approve": "統合候補承認",
  "mergeSuggestion.reject": "統合候補却下",
};

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

function isSensitiveMetadataKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_METADATA_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey));
}

function sanitizeMetadata(value: Prisma.JsonValue): Prisma.JsonValue {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeMetadata(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const jsonItem = item === undefined ? null : (item as Prisma.JsonValue);
      return [key, isSensitiveMetadataKey(key) ? "[非表示]" : sanitizeMetadata(jsonItem)];
    })
  );
}

function metadataToText(value: Prisma.JsonValue | null) {
  if (!value) return "-";

  try {
    const text = JSON.stringify(sanitizeMetadata(value), null, 2);
    return text.length > 800 ? `${text.slice(0, 800)}...` : text;
  } catch {
    return "-";
  }
}

function buildHref(params: {
  action: string;
  targetType: string;
  adminUserId: string;
  targetUserId: string;
  pageSize: number;
  page: number;
}) {
  const search = new URLSearchParams();
  if (params.action) search.set("action", params.action);
  if (params.targetType) search.set("targetType", params.targetType);
  if (params.adminUserId) search.set("adminUserId", params.adminUserId);
  if (params.targetUserId) search.set("targetUserId", params.targetUserId);
  if (params.page !== 1) search.set("page", String(params.page));
  if (params.pageSize !== DEFAULT_PAGE_SIZE) {
    search.set("pageSize", String(params.pageSize));
  }
  const query = search.toString();
  return query ? `/admin/audit-logs?${query}` : "/admin/audit-logs";
}

function targetHref(targetType: string, targetId: string | null) {
  if (!targetId) return null;
  if (targetType === "Report") return `/admin/reports/${targetId}`;
  if (targetType === "User") return `/admin/users/${targetId}`;
  return null;
}

function UserLabel({
  user,
  fallback,
}: {
  user: { id: string; name: string; handle: string | null } | null | undefined;
  fallback: string;
}) {
  if (!user) return <span className="text-gray-400">{fallback}</span>;

  return (
    <span>
      {user.name}
      {user.handle ? <span className="ml-1 font-mono text-xs text-gray-500">@{user.handle}</span> : null}
    </span>
  );
}

export default async function AdminAuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const params = await searchParams;
  const action = params.action?.trim() || "";
  const targetType = params.targetType?.trim() || "";
  const adminUserId = params.adminUserId?.trim() || "";
  const targetUserId = params.targetUserId?.trim() || "";
  const page = parsePositiveInt(params.page, 1);
  const pageSize = Math.min(parsePositiveInt(params.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const where: Prisma.AdminAuditLogWhereInput = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (adminUserId) where.adminUserId = adminUserId;
  if (targetUserId) where.targetUserId = targetUserId;

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
  const targetUserIds = Array.from(
    new Set(logs.map((log) => log.targetUserId).filter((id): id is string => Boolean(id)))
  );
  const targetUsers =
    targetUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: targetUserIds } },
          select: {
            id: true,
            name: true,
            handle: true,
          },
        })
      : [];
  const targetUserById = new Map(targetUsers.map((user) => [user.id, user]));

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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_140px_auto]">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">操作</span>
            <input
              name="action"
              defaultValue={action}
              list="audit-action-options"
              placeholder="work.merge"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <datalist id="audit-action-options">
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {actionLabels[option] ?? option}
                </option>
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">対象種別</span>
            <input
              name="targetType"
              defaultValue={targetType}
              list="audit-target-type-options"
              placeholder="Work"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <datalist id="audit-target-type-options">
              {targetTypeOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">管理者ID</span>
            <input
              name="adminUserId"
              defaultValue={adminUserId}
              placeholder="admin user id"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">対象ユーザーID</span>
            <input
              name="targetUserId"
              defaultValue={targetUserId}
              placeholder="target user id"
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
            <table className="min-w-[1280px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">日時</th>
                  <th className="px-4 py-3">管理者</th>
                  <th className="px-4 py-3">操作</th>
                  <th className="px-4 py-3">対象種別</th>
                  <th className="px-4 py-3">対象ID</th>
                  <th className="px-4 py-3">対象ユーザー</th>
                  <th className="px-4 py-3">理由</th>
                  <th className="px-4 py-3">metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => {
                  const href = targetHref(log.targetType, log.targetId);
                  const targetUser = log.targetUserId
                    ? targetUserById.get(log.targetUserId) ?? null
                    : null;

                  return (
                    <tr key={log.id} className="align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <UserLabel user={log.admin} fallback="削除済み管理者" />
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-semibold">
                          {actionLabels[log.action] ?? log.action}
                        </div>
                        <div className="mt-1 font-mono text-xs text-gray-500">{log.action}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {log.targetType}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {href ? (
                          <Link href={href} className="text-amber-700 hover:underline">
                            {log.targetId}
                          </Link>
                        ) : (
                          log.targetId || "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {log.targetUserId ? (
                          <Link
                            href={`/admin/users/${log.targetUserId}`}
                            className="hover:text-amber-700 hover:underline"
                          >
                            <UserLabel user={targetUser} fallback={log.targetUserId} />
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{log.reason || "-"}</td>
                      <td className="px-4 py-3">
                        <pre className="max-w-md whitespace-pre-wrap break-words rounded bg-gray-50 p-2 text-xs text-gray-600">
                          {metadataToText(log.metadata)}
                        </pre>
                      </td>
                    </tr>
                  );
                })}
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
            adminUserId,
            targetUserId,
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
            adminUserId,
            targetUserId,
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
