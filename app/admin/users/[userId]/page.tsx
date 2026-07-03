import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getAdminUserDetail } from "@/lib/admin-users";
import { SuspensionControls } from "./SuspensionControls";

type AdminUserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

function formatDate(value: Date | string | null) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | string | null) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLastActivityDateTime(value: Date | string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function valueOrUnset(value: string | null) {
  return value?.trim() || "未設定";
}

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

const reportStatusLabels: Record<string, string> = {
  pending: "未対応",
  reviewing: "確認中",
  resolved: "対応済み",
  rejected: "却下",
  dismissed: "対応不要",
};

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const { userId } = await params;
  const [session, detail] = await Promise.all([auth(), getAdminUserDetail(userId)]);

  if (!detail) {
    notFound();
  }

  const { user, activity, reportSummary, recentReports } = detail;
  const canManageSuspension =
    session?.user?.id &&
    session.user.id !== user.id &&
    !user.isAdmin &&
    !user.deactivatedAt;
  const isSuspended = user.accountStatus === "suspended";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="border-b pb-5">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="hover:text-amber-700 hover:underline">
            管理者画面
          </Link>
          <span className="mx-2">/</span>
          <Link href="/admin/users" className="hover:text-amber-700 hover:underline">
            利用者一覧
          </Link>
          <span className="mx-2">/</span>
          利用者詳細
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">利用者詳細</h1>
        <p className="mt-2 text-sm text-gray-500">
          利用者の状態を確認するための読み取り専用ページです。編集・削除・利用制限はできません。
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <SectionTitle>基本情報</SectionTitle>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoItem label="ユーザーID" value={user.id} mono />
            <InfoItem label="表示名" value={user.name} />
            <InfoItem label="handle" value={user.handle ? `@${user.handle}` : "未設定"} mono />
            <InfoItem label="メール" value={user.maskedEmail} />
            <InfoItem label="管理者フラグ">
              {user.isAdmin ? <Badge tone="amber">管理者</Badge> : <Badge>一般</Badge>}
            </InfoItem>
            <InfoItem label="メール確認">
              {user.emailVerified ? <Badge tone="green">確認済み</Badge> : <Badge>未確認</Badge>}
            </InfoItem>
            <InfoItem label="公開状態">
              {user.isPublic ? <Badge tone="green">公開</Badge> : <Badge>非公開</Badge>}
            </InfoItem>
            <InfoItem label="退会状態">
              {user.deactivatedAt ? <Badge tone="red">退会済み</Badge> : <Badge tone="green">利用中</Badge>}
            </InfoItem>
            <InfoItem label="アカウント状態">
              {user.deactivatedAt ? (
                <Badge tone="red">退会済み</Badge>
              ) : isSuspended ? (
                <Badge tone="amber">停止中</Badge>
              ) : (
                <Badge tone="green">利用中</Badge>
              )}
            </InfoItem>
            <InfoItem label="停止日時" value={formatDate(user.suspendedAt)} />
            <InfoItem label="停止期限" value={formatDate(user.suspendedUntil)} />
            <InfoItem label="停止理由" value={valueOrUnset(user.suspendedReason)} wide />
            <InfoItem label="画像" value={user.hasImage ? "画像あり" : "画像なし"} />
            <InfoItem label="外部画像URL" value={user.hasExternalImage ? "あり" : "なし"} />
            <InfoItem label="登録日" value={formatDate(user.createdAt)} />
            <InfoItem label="最後にブントモで操作した日" value={formatLastActivityDateTime(user.lastActivityAt)} />
            <InfoItem label="更新日" value={formatDate(user.updatedAt)} />
            <InfoItem label="退会日時" value={formatDate(user.deactivatedAt)} />
            <InfoItem label="削除予定日" value={formatDate(user.scheduledDeletionAt)} />
          </dl>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <SectionTitle>リンク</SectionTitle>
          <div className="mt-4 space-y-3 text-sm">
            <Link
              href="/admin/users"
              className="block rounded-md border px-3 py-2 font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              利用者一覧へ戻る
            </Link>
            {user.deactivatedAt ? (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500">
                退会済みのため、公開プロフィールは404になる可能性があります。
              </div>
            ) : (
              <Link
                href={`/users/${user.id}`}
                className="block rounded-md border px-3 py-2 font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                公開プロフィールを開く
              </Link>
            )}
          </div>
        </section>
      </div>

      {canManageSuspension ? (
        <SuspensionControls userId={user.id} isSuspended={isSuspended} />
      ) : null}

      <section className="mt-5 rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>通報サマリー</SectionTitle>
          {reportSummary.pending + reportSummary.reviewing > 0 ? (
            <Badge tone="amber">
              未対応・確認中 {reportSummary.pending + reportSummary.reviewing}件
            </Badge>
          ) : (
            <Badge>未対応なし</Badge>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="総数" value={reportSummary.total} />
          <Metric label="未対応" value={reportSummary.pending} />
          <Metric label="確認中" value={reportSummary.reviewing} />
          <Metric label="対応済み" value={reportSummary.resolved} />
          <Metric label="却下" value={reportSummary.rejected} />
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-gray-700">最近の通報</h3>
          {recentReports.length === 0 ? (
            <p className="mt-3 rounded-md bg-gray-50 px-3 py-4 text-sm text-gray-500">
              このユーザーを対象にした通報はありません。
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">日時</th>
                    <th className="px-3 py-2">対象</th>
                    <th className="px-3 py-2">理由</th>
                    <th className="px-3 py-2">status</th>
                    <th className="px-3 py-2">通報者</th>
                    <th className="px-3 py-2">詳細</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentReports.map((report) => (
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
                        {reportStatusLabels[report.status] ?? report.status}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {report.reporter ? (
                          <span>
                            {report.reporter.name}
                            {report.reporter.handle ? (
                              <span className="ml-1 font-mono text-xs text-gray-500">
                                @{report.reporter.handle}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-gray-400">削除済みユーザー</span>
                        )}
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
            DM本文の全文やプレビューは、この利用者詳細には表示していません。
          </p>
        </div>
      </section>

      <section className="mt-5 rounded-lg border bg-white p-5 shadow-sm">
        <SectionTitle>プロフィール情報</SectionTitle>
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <InfoItem label="自己紹介" value={valueOrUnset(user.bio)} wide />
          <InfoItem label="住まい" value={valueOrUnset(user.area)} />
          <InfoItem label="X" value={valueOrUnset(user.linkX)} />
          <InfoItem label="Instagram" value={valueOrUnset(user.linkInstagram)} />
          <InfoItem label="Webサイト" value={valueOrUnset(user.linkWebsite)} />
          <InfoItem label="Webサイト表示名" value={valueOrUnset(user.linkWebsiteLabel)} />
          <InfoItem label="カスタムリンク件数" value={`${user.customLinkCount}件`} />
          <InfoItem label="visibility parse" value={user.visibilityParseFailed ? "確認できません" : "確認済み"} />
        </dl>

        {user.customLinks.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-700">カスタムリンク</h3>
            <ul className="mt-2 space-y-2 text-sm text-gray-600">
              {user.customLinks.map((link, index) => (
                <li key={`${link.label}-${link.url}-${index}`} className="rounded-md bg-gray-50 px-3 py-2">
                  <span className="font-medium text-gray-800">{link.label || "ラベル未設定"}</span>
                  <span className="mx-2 text-gray-300">/</span>
                  <span className="break-all">{link.url || "URL未設定"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {user.visibility && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-700">公開範囲の概要</h3>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs">
              {user.visibility.map((entry) => (
                <li key={entry.field} className="rounded-full border bg-gray-50 px-3 py-1 text-gray-600">
                  {entry.field}: {entry.visibility}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-lg border bg-white p-5 shadow-sm">
        <SectionTitle>活動サマリー</SectionTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="読書記録数" value={activity.readingTotal} />
          <Metric label="読書中数" value={activity.readingNow} />
          <Metric label="読了数" value={activity.completedReadings} />
          <Metric label="bookIdなし読書記録" value={activity.booklessReadings} />
          <Metric label="レビュー数" value={activity.reviewCount} />
          <Metric label="主催した読書会数" value={activity.hostedEventCount} />
          <Metric label="参加予定の読書会数" value={activity.attendingEventCount ?? "未集計"} />
          <Metric label="友だち数" value={activity.friendCount} />
          <Metric label="DM件数" value={activity.directMessageCount} />
          <Metric label="DM会話数" value={activity.directMessageConversationCount} />
        </div>
        <p className="mt-3 text-xs text-gray-400">
          DM本文、認証情報、トークン、Account情報は表示していません。
        </p>
      </section>
    </main>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-gray-900">{children}</h2>;
}

function InfoItem({
  label,
  value,
  children,
  mono = false,
  wide = false,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className={`mt-1 break-words text-sm text-gray-900 ${mono ? "font-mono text-xs" : ""}`}>
        {children ?? value ?? "未設定"}
      </dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-4">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums text-gray-900">{value}</p>
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
