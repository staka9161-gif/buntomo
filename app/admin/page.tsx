import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "管理",
};

const menuItems = [
  {
    href: "/admin/users",
    title: "利用者一覧",
    description: "登録ユーザー、退会状態、読書記録数、友だち数を読み取り専用で確認します。",
  },
  {
    href: "/admin/audit-logs",
    title: "監査ログ",
    description: "管理者操作の履歴を読み取り専用で確認します。",
  },
  {
    href: "/admin/reports",
    title: "通報確認",
    description: "ユーザーから届いた通報を確認します。",
  },
  {
    href: "/admin/suspension-appeals",
    title: "停止異議申し立て",
    description: "利用停止中ユーザーから届いた異議申し立てを確認します。",
  },
  {
    href: "/admin/announcements",
    title: "重要なお知らせ",
    description: "通常ページ上部に表示する、運営からの重要なお知らせを管理します。",
  },
  {
    href: "/admin/dashboard",
    title: "管理ダッシュボード",
    description: "Work / Edition の状態や統合候補の件数を確認します。",
  },
  {
    href: "/admin/merge-suggestions",
    title: "作品統合候補",
    description: "ユーザーから報告された作品統合候補を確認します。",
  },
];

const plannedItems: string[] = [];

const reportTargetTypeLabels: Record<string, string> = {
  USER: "ユーザー",
  BOOK_CHAT_MESSAGE: "本別チャット",
  REVIEW: "レビュー",
  READING_EVENT: "読書会",
  DIRECT_MESSAGE: "DM",
};

const reportReasonLabels: Record<string, string> = {
  inappropriate_profile: "不適切なプロフィール",
  inappropriate_content: "不適切な内容",
  harassment: "迷惑行為",
  impersonation: "なりすましの疑い",
  spam_or_scam: "スパム・詐欺の疑い",
  other: "その他",
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
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

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const admin = await isAdmin(session.user.id);

  if (!admin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900">管理画面</h1>
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          管理者権限が必要です。
        </p>
      </main>
    );
  }

  const [
    pendingReports,
    reviewingReports,
    suspendedUsers,
    deactivatedUsers,
    scheduledDeletionUsers,
    pendingSuspensionAppeals,
    reviewingSuspensionAppeals,
    publishedAnnouncements,
    draftAnnouncements,
    recentPendingReports,
  ] = await Promise.all([
    prisma.report.count({ where: { status: "pending" } }),
    prisma.report.count({ where: { status: "reviewing" } }),
    prisma.user.count({ where: { accountStatus: "suspended", deactivatedAt: null } }),
    prisma.user.count({ where: { deactivatedAt: { not: null } } }),
    prisma.user.count({ where: { scheduledDeletionAt: { not: null } } }),
    prisma.suspensionAppeal.count({ where: { status: "pending" } }),
    prisma.suspensionAppeal.count({ where: { status: "reviewing" } }),
    prisma.importantAnnouncement.count({ where: { status: "published" } }),
    prisma.importantAnnouncement.count({ where: { status: "draft" } }),
    prisma.report.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        targetType: true,
        reason: true,
        status: true,
        createdAt: true,
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

  const summaryCards = [
    {
      label: "未対応通報",
      value: pendingReports,
      href: "/admin/reports?status=pending",
      tone: pendingReports > 0 ? "amber" : "gray",
    },
    {
      label: "確認中通報",
      value: reviewingReports,
      href: "/admin/reports?status=reviewing",
      tone: reviewingReports > 0 ? "amber" : "gray",
    },
    {
      label: "停止中ユーザー",
      value: suspendedUsers,
      href: "/admin/users?status=suspended",
      tone: suspendedUsers > 0 ? "amber" : "gray",
    },
    {
      label: "退会済みユーザー",
      value: deactivatedUsers,
      href: "/admin/users?status=deactivated",
      tone: "gray",
    },
    {
      label: "削除予定ユーザー",
      value: scheduledDeletionUsers,
      href: "/admin/users?status=scheduledDeletion",
      tone: scheduledDeletionUsers > 0 ? "amber" : "gray",
    },
    {
      label: "停止異議 未対応",
      value: pendingSuspensionAppeals,
      href: "/admin/suspension-appeals?status=pending",
      tone: pendingSuspensionAppeals > 0 ? "amber" : "gray",
    },
    {
      label: "停止異議 確認中",
      value: reviewingSuspensionAppeals,
      href: "/admin/suspension-appeals?status=reviewing",
      tone: reviewingSuspensionAppeals > 0 ? "amber" : "gray",
    },
    {
      label: "重要なお知らせ 公開中",
      value: publishedAnnouncements,
      href: "/admin/announcements?status=published",
      tone: publishedAnnouncements > 0 ? "amber" : "gray",
    },
    {
      label: "重要なお知らせ 下書き",
      value: draftAnnouncements,
      href: "/admin/announcements?status=draft",
      tone: "gray",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="border-b pb-5">
        <h1 className="text-2xl font-bold text-gray-900">管理画面</h1>
        <p className="mt-2 text-sm text-gray-500">
          管理者向けの確認・運用メニューです。
        </p>
      </div>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-gray-900">運用サマリー</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`rounded-lg border p-4 shadow-sm transition hover:border-amber-300 ${
                card.tone === "amber" ? "border-amber-200 bg-amber-50" : "bg-white"
              }`}
            >
              <p className="text-xs font-semibold text-gray-500">{card.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{card.value}件</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">最近の未対応通報</h2>
          <Link
            href="/admin/reports?status=pending"
            className="text-sm font-semibold text-amber-700 hover:underline"
          >
            未対応通報をすべて見る
          </Link>
        </div>
        {recentPendingReports.length === 0 ? (
          <p className="mt-4 rounded-md bg-gray-50 px-3 py-4 text-sm text-gray-500">
            未対応の通報はありません。
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">日時</th>
                  <th className="px-3 py-2">対象</th>
                  <th className="px-3 py-2">理由</th>
                  <th className="px-3 py-2">対象ユーザー</th>
                  <th className="px-3 py-2">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentPendingReports.map((report) => (
                  <tr key={report.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                      {formatDateTime(report.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {reportTargetTypeLabels[report.targetType] ?? report.targetType}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {reportReasonLabels[report.reason] ?? report.reason}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      <UserLabel user={report.targetUser} fallback="削除済みユーザー" />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/reports/${report.id}`}
                        className="font-semibold text-amber-700 hover:underline"
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
        <p className="mt-3 text-xs text-gray-400">
          本文プレビューやDM本文はこのトップ画面には表示しません。
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border bg-white p-5 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
          >
            <h2 className="text-base font-semibold text-gray-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-8 rounded-lg border bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-700">今後追加予定</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {plannedItems.map((item) => (
            <span
              key={item}
              className="rounded-full border bg-white px-3 py-1 text-xs text-gray-500"
            >
              {item}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
