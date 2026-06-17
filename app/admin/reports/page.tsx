import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type AdminReportsPageProps = {
  searchParams: Promise<{
    status?: string;
    targetType?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const statusOptions = [
  { value: "", label: "すべて" },
  { value: "pending", label: "未確認" },
  { value: "reviewing", label: "確認中" },
  { value: "resolved", label: "対応済み" },
  { value: "rejected", label: "却下" },
  { value: "dismissed", label: "対応不要" },
];

const targetTypeOptions = [
  { value: "", label: "すべて" },
  { value: "USER", label: "ユーザー" },
  { value: "BOOK_CHAT_MESSAGE", label: "本別チャット" },
  { value: "REVIEW", label: "レビュー" },
  { value: "READING_EVENT", label: "読書会" },
  { value: "DIRECT_MESSAGE", label: "DM" },
];

const reasonLabels: Record<string, string> = {
  inappropriate_profile: "不適切なプロフィール",
  inappropriate_content: "不適切な内容",
  harassment: "迷惑行為",
  impersonation: "なりすましの疑い",
  spam_or_scam: "スパム・詐欺の疑い",
  other: "その他",
};

const statusLabels: Record<string, string> = {
  pending: "未確認",
  reviewing: "確認中",
  resolved: "対応済み",
  rejected: "却下",
  dismissed: "対応不要",
};

const targetTypeLabels: Record<string, string> = {
  USER: "ユーザー",
  BOOK_CHAT_MESSAGE: "本別チャット",
  REVIEW: "レビュー",
  READING_EVENT: "読書会",
  DIRECT_MESSAGE: "DM",
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

function truncatePreview(value: string | null | undefined) {
  if (!value) return null;
  return value.length > 80 ? `${value.slice(0, 80)}...` : value;
}

function userLabel(user: { name: string; handle: string | null }) {
  return user.handle ? `${user.name} (@${user.handle})` : user.name;
}

function buildHref(params: {
  status: string;
  targetType: string;
  pageSize: number;
  page: number;
}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.targetType) search.set("targetType", params.targetType);
  if (params.page !== 1) search.set("page", String(params.page));
  if (params.pageSize !== DEFAULT_PAGE_SIZE) {
    search.set("pageSize", String(params.pageSize));
  }
  const query = search.toString();
  return query ? `/admin/reports?${query}` : "/admin/reports";
}

function UserLabel({
  user,
  fallback,
}: {
  user: { id: string; name: string; handle: string | null } | null;
  fallback: string;
}) {
  if (!user) {
    return <span className="text-gray-400">{fallback}</span>;
  }

  return (
    <span>
      {user.name}
      {user.handle ? (
        <span className="ml-1 font-mono text-xs text-gray-500">@{user.handle}</span>
      ) : null}
    </span>
  );
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const params = await searchParams;
  const status = params.status?.trim() || "";
  const targetType = params.targetType?.trim() || "";
  const page = parsePositiveInt(params.page, 1);
  const pageSize = Math.min(parsePositiveInt(params.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

  const where: Prisma.ReportWhereInput = {};
  if (status) where.status = status;
  if (targetType) where.targetType = targetType;

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        targetUserId: true,
        reason: true,
        detail: true,
        status: true,
        createdAt: true,
        reporter: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
      },
    }),
  ]);

  const chatMessageIds = reports
    .filter((report) => report.targetType === "BOOK_CHAT_MESSAGE")
    .map((report) => report.targetId);
  const chatMessages =
    chatMessageIds.length > 0
      ? await prisma.chatMessage.findMany({
          where: { id: { in: chatMessageIds } },
          select: {
            id: true,
            content: true,
          },
        })
      : [];
  const chatPreviewById = new Map(
    chatMessages.map((message) => [message.id, truncatePreview(message.content)])
  );
  const reviewIds = reports
    .filter((report) => report.targetType === "REVIEW")
    .map((report) => report.targetId);
  const reviews =
    reviewIds.length > 0
      ? await prisma.review.findMany({
          where: { id: { in: reviewIds } },
          select: {
            id: true,
            body: true,
            work: {
              select: {
                title: true,
              },
            },
            edition: {
              select: {
                titleOnCover: true,
              },
            },
          },
        })
      : [];
  const reviewPreviewById = new Map(
    reviews.map((review) => [
      review.id,
      truncatePreview(`${review.edition?.titleOnCover ?? review.work.title}: ${review.body}`),
    ])
  );
  const eventIds = reports
    .filter((report) => report.targetType === "READING_EVENT")
    .map((report) => report.targetId);
  const readingEvents =
    eventIds.length > 0
      ? await prisma.readingEvent.findMany({
          where: { id: { in: eventIds } },
          select: {
            id: true,
            title: true,
            eventDate: true,
            book: {
              select: {
                title: true,
              },
            },
            work: {
              select: {
                title: true,
              },
            },
          },
        })
      : [];
  const eventPreviewById = new Map(
    readingEvents.map((event) => [
      event.id,
      truncatePreview(
        `${event.title} / ${event.book?.title ?? event.work?.title ?? "関連本なし"} / ${event.eventDate.toISOString().slice(0, 10)}`
      ),
    ])
  );
  const directMessageIds = reports
    .filter((report) => report.targetType === "DIRECT_MESSAGE")
    .map((report) => report.targetId);
  const directMessages =
    directMessageIds.length > 0
      ? await prisma.directMessage.findMany({
          where: { id: { in: directMessageIds } },
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: {
              select: {
                name: true,
                handle: true,
              },
            },
            recipient: {
              select: {
                name: true,
                handle: true,
              },
            },
          },
        })
      : [];
  const directMessagePreviewById = new Map(
    directMessages.map((message) => [
      message.id,
      truncatePreview(
        `${userLabel(message.sender)} → ${userLabel(message.recipient)} / ${formatDateTime(message.createdAt)} / ${message.content}`
      ),
    ])
  );
  const getTargetPreview = (report: { targetType: string; targetId: string }) => {
    if (report.targetType === "BOOK_CHAT_MESSAGE") {
      return chatPreviewById.get(report.targetId) ?? "-";
    }
    if (report.targetType === "REVIEW") {
      return reviewPreviewById.get(report.targetId) ?? "-";
    }
    if (report.targetType === "READING_EVENT") {
      return eventPreviewById.get(report.targetId) ?? "-";
    }
    if (report.targetType === "DIRECT_MESSAGE") {
      return directMessagePreviewById.get(report.targetId) ?? "-";
    }
    return "-";
  };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="border-b pb-5">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="hover:text-amber-700 hover:underline">
            管理画面
          </Link>
          <span className="mx-2">/</span>
          通報確認
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">通報確認</h1>
        <p className="mt-2 text-sm text-gray-500">
          ユーザーから届いた通報を管理者向けに確認します。対応やステータス変更は次のフェーズで追加します。
        </p>
      </div>

      <form className="mt-6 rounded-lg border bg-white p-4 shadow-sm" action="/admin/reports">
        <div className="grid gap-3 md:grid-cols-[180px_180px_140px_auto]">
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
            <span className="text-xs font-semibold text-gray-600">対象</span>
            <select
              name="targetType"
              defaultValue={targetType}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {targetTypeOptions.map((option) => (
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
              href="/admin/reports"
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
            {total}件中 {reports.length}件を表示
          </p>
          <p className="text-xs text-gray-400">メールアドレスや認証情報は表示しません。</p>
        </div>

        {reports.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            通報はまだありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">日時</th>
                  <th className="px-4 py-3">status</th>
                  <th className="px-4 py-3">targetType</th>
                  <th className="px-4 py-3">reason</th>
                  <th className="px-4 py-3">detail</th>
                  <th className="px-4 py-3">preview</th>
                  <th className="px-4 py-3">reporter</th>
                  <th className="px-4 py-3">targetUser</th>
                  <th className="px-4 py-3">targetId</th>
                  <th className="px-4 py-3">detail</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.map((report) => (
                  <tr key={report.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDateTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {statusLabels[report.status] ?? report.status}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {targetTypeLabels[report.targetType] ?? report.targetType}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {reasonLabels[report.reason] ?? report.reason}
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-md whitespace-pre-wrap break-words text-gray-700">
                        {report.detail || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-xs whitespace-pre-wrap break-words text-gray-600">
                        {getTargetPreview(report)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <UserLabel user={report.reporter} fallback="削除済みユーザー" />
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <UserLabel user={report.targetUser} fallback="削除済みユーザー" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {report.targetId}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/reports/${report.id}`}
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
          href={buildHref({
            status,
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
            status,
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
