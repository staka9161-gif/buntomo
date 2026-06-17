import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ReportStatusForm from "./ReportStatusForm";

type AdminReportDetailPageProps = {
  params: Promise<{ reportId: string }>;
};

const statusLabels: Record<string, string> = {
  pending: "未対応",
  reviewing: "確認中",
  resolved: "対応済み",
  rejected: "却下",
  dismissed: "対応不要",
};

const reasonLabels: Record<string, string> = {
  inappropriate_profile: "不適切なプロフィール",
  inappropriate_content: "不適切な内容",
  harassment: "迷惑行為",
  impersonation: "なりすましの疑い",
  spam_or_scam: "スパム・詐欺の疑い",
  other: "その他",
};

const targetTypeLabels: Record<string, string> = {
  USER: "ユーザー",
  BOOK_CHAT_MESSAGE: "本別チャット",
  REVIEW: "レビュー",
  READING_EVENT: "読書会",
};

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

function truncatePreview(value: string | null | undefined, maxLength = 160) {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
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

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export default async function AdminReportDetailPage({ params }: AdminReportDetailPageProps) {
  const { reportId } = await params;
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      targetUserId: true,
      reason: true,
      detail: true,
      status: true,
      adminNote: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
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
      adminUser: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
    },
  });

  if (!report) {
    notFound();
  }

  const chatMessage =
    report.targetType === "BOOK_CHAT_MESSAGE"
      ? await prisma.chatMessage.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            content: true,
            createdAt: true,
            bookId: true,
            workId: true,
            user: {
              select: {
                id: true,
                name: true,
                handle: true,
              },
            },
            book: {
              select: {
                id: true,
                title: true,
              },
            },
            work: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })
      : null;
  const review =
    report.targetType === "REVIEW"
      ? await prisma.review.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            body: true,
            rating: true,
            postedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                handle: true,
              },
            },
            work: {
              select: {
                id: true,
                title: true,
              },
            },
            edition: {
              select: {
                id: true,
                titleOnCover: true,
                publisher: true,
              },
            },
          },
        })
      : null;
  const readingEvent =
    report.targetType === "READING_EVENT"
      ? await prisma.readingEvent.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            title: true,
            eventDate: true,
            prefecture: true,
            location: true,
            url: true,
            organizer: {
              select: {
                id: true,
                name: true,
                handle: true,
              },
            },
            book: {
              select: {
                id: true,
                title: true,
              },
            },
            work: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })
      : null;

  const targetUserHref = report.targetUserId ? `/users/${report.targetUserId}` : null;
  const chatTargetHref = chatMessage?.bookId
    ? `/books/${chatMessage.bookId}/chat`
    : chatMessage?.workId
      ? `/works/${chatMessage.workId}`
      : null;
  const reviewTargetHref = review?.work ? `/works/${review.work.id}` : null;
  const readingEventTargetHref = readingEvent?.book
    ? `/books/${readingEvent.book.id}`
    : readingEvent?.work
      ? `/works/${readingEvent.work.id}`
      : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="border-b pb-5">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="hover:text-amber-700 hover:underline">
            管理画面
          </Link>
          <span className="mx-2">/</span>
          <Link href="/admin/reports" className="hover:text-amber-700 hover:underline">
            通報確認
          </Link>
          <span className="mx-2">/</span>
          通報詳細
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">通報詳細</h1>
        <p className="mt-2 text-sm text-gray-500">
          通報内容の確認とステータス変更を行います。利用制限や通知はこの画面では行いません。
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">基本情報</h2>
            <dl className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="通報ID">{report.id}</Field>
              <Field label="status">{statusLabels[report.status] ?? report.status}</Field>
              <Field label="通報日時">{formatDateTime(report.createdAt)}</Field>
              <Field label="更新日時">{formatDateTime(report.updatedAt)}</Field>
              <Field label="対応完了日時">{formatDateTime(report.resolvedAt)}</Field>
              <Field label="通報理由">{reasonLabels[report.reason] ?? report.reason}</Field>
              <Field label="通報者">
                <UserLabel user={report.reporter} fallback="削除済みユーザー" />
              </Field>
              <Field label="対象ユーザー">
                {targetUserHref && report.targetUser ? (
                  <Link href={targetUserHref} className="text-amber-700 hover:underline">
                    <UserLabel user={report.targetUser} fallback="削除済みユーザー" />
                  </Link>
                ) : (
                  <UserLabel user={report.targetUser} fallback="削除済みユーザー" />
                )}
              </Field>
              <Field label="対象種別">
                {targetTypeLabels[report.targetType] ?? report.targetType}
              </Field>
              <Field label="対象ID">
                <span className="font-mono text-xs">{report.targetId}</span>
              </Field>
              <Field label="最終対応管理者">
                <UserLabel user={report.adminUser} fallback="-" />
              </Field>
            </dl>
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-500">詳細</h3>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-900">
                {report.detail || "-"}
              </p>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">対象情報</h2>
            {report.targetType === "USER" ? (
              <div className="mt-4 space-y-2 text-sm text-gray-700">
                <p>
                  対象ユーザー:{" "}
                  {targetUserHref && report.targetUser ? (
                    <Link href={targetUserHref} className="text-amber-700 hover:underline">
                      <UserLabel user={report.targetUser} fallback="削除済みユーザー" />
                    </Link>
                  ) : (
                    <UserLabel user={report.targetUser} fallback="削除済みユーザー" />
                  )}
                </p>
              </div>
            ) : report.targetType === "BOOK_CHAT_MESSAGE" ? (
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                {chatMessage ? (
                  <>
                    <p>
                      投稿者: <UserLabel user={chatMessage.user} fallback="削除済みユーザー" />
                    </p>
                    <p>投稿日時: {formatDateTime(chatMessage.createdAt)}</p>
                    <p>
                      関連:{" "}
                      {chatTargetHref ? (
                        <Link href={chatTargetHref} className="text-amber-700 hover:underline">
                          {chatMessage.book?.title ?? chatMessage.work?.title ?? "関連ページ"}
                        </Link>
                      ) : (
                        <span className="text-gray-400">関連ページなし</span>
                      )}
                    </p>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500">本文プレビュー</h3>
                      <p className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-900">
                        {truncatePreview(chatMessage.content) || "-"}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500">対象のチャット投稿は見つかりません。</p>
                )}
              </div>
            ) : report.targetType === "REVIEW" ? (
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                {review ? (
                  <>
                    <p>
                      投稿者: <UserLabel user={review.user} fallback="削除済みユーザー" />
                    </p>
                    <p>投稿日時: {formatDateTime(review.postedAt)}</p>
                    <p>評価: {review.rating ?? "-"}</p>
                    <p>
                      関連:{" "}
                      {reviewTargetHref ? (
                        <Link href={reviewTargetHref} className="text-amber-700 hover:underline">
                          {review.edition?.titleOnCover ?? review.work.title}
                        </Link>
                      ) : (
                        <span className="text-gray-400">関連ページなし</span>
                      )}
                    </p>
                    {review.edition?.publisher ? <p>出版社: {review.edition.publisher}</p> : null}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500">本文プレビュー</h3>
                      <p className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-900">
                        {truncatePreview(review.body) || "-"}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500">対象のレビューは見つかりません。</p>
                )}
              </div>
            ) : report.targetType === "READING_EVENT" ? (
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                {readingEvent ? (
                  <>
                    <p>
                      主催者: <UserLabel user={readingEvent.organizer} fallback="削除済みユーザー" />
                    </p>
                    <p>読書会名: {readingEvent.title}</p>
                    <p>開催日時: {formatDateTime(readingEvent.eventDate)}</p>
                    <p>
                      場所: {readingEvent.prefecture} {readingEvent.location}
                    </p>
                    <p>
                      関連:{" "}
                      {readingEventTargetHref ? (
                        <Link href={readingEventTargetHref} className="text-amber-700 hover:underline">
                          {readingEvent.book?.title ?? readingEvent.work?.title ?? "関連ページ"}
                        </Link>
                      ) : (
                        <span className="text-gray-400">関連ページなし</span>
                      )}
                    </p>
                    {readingEvent.url ? (
                      <p>
                        申込URL:{" "}
                        <a
                          href={readingEvent.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-700 hover:underline"
                        >
                          外部ページ
                        </a>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-gray-500">対象の読書会は見つかりません。</p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">対象情報はありません。</p>
            )}
          </section>
        </div>

        <ReportStatusForm
          reportId={report.id}
          initialStatus={report.status}
          initialAdminNote={report.adminNote ?? ""}
        />
      </div>
    </main>
  );
}
