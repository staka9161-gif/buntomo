import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { updateNoticeStatusLabels } from "@/lib/update-notices";
import UpdateNoticeForm from "./UpdateNoticeForm";

type AdminUpdateNoticeDetailPageProps = {
  params: Promise<{ noticeId: string }>;
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

function toDateTimeLocal(value: Date | null) {
  if (!value) return "";
  const offset = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
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

export default async function AdminUpdateNoticeDetailPage({
  params,
}: AdminUpdateNoticeDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const admin = await isAdmin(session.user.id);
  if (!admin) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900">お知らせ管理</h1>
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          管理者権限が必要です。
        </p>
      </main>
    );
  }

  const { noticeId } = await params;
  const notice = await prisma.updateNotice.findUnique({
    where: { id: noticeId },
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      topicTag: true,
      href: true,
      status: true,
      publishedAt: true,
      displayDate: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
    },
  });

  if (!notice) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="border-b pb-5">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="hover:text-amber-700 hover:underline">
            管理画面
          </Link>
          <span className="mx-2">/</span>
          <Link href="/admin/update-notices" className="hover:text-amber-700 hover:underline">
            お知らせ管理
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{notice.title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          通常の /updates に表示するお知らせを編集します。重要なお知らせバナーとは別です。
        </p>
      </div>

      <section className="mt-6 grid gap-4 rounded-lg border bg-white p-5 text-sm shadow-sm md:grid-cols-2">
        <div>
          <span className="font-semibold text-gray-600">status</span>
          <p className="mt-1 text-gray-900">
            {updateNoticeStatusLabels[notice.status as keyof typeof updateNoticeStatusLabels] ?? notice.status}
          </p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">種別</span>
          <p className="mt-1 text-gray-900">{notice.type}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">内容タグ</span>
          <p className="mt-1 text-gray-900">{notice.topicTag ?? "-"}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">リンク</span>
          <p className="mt-1 break-all text-gray-900">{notice.href ?? "-"}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">表示日</span>
          <p className="mt-1 text-gray-900">{formatDateTime(notice.displayDate)}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">公開日時</span>
          <p className="mt-1 text-gray-900">{formatDateTime(notice.publishedAt)}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">作成者</span>
          <p className="mt-1 text-gray-900">
            <UserLabel user={notice.createdBy} fallback="削除済み管理者" />
          </p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">最終更新者</span>
          <p className="mt-1 text-gray-900">
            <UserLabel user={notice.updatedBy} fallback="削除済み管理者" />
          </p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">作成日時</span>
          <p className="mt-1 text-gray-900">{formatDateTime(notice.createdAt)}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">更新日時</span>
          <p className="mt-1 text-gray-900">{formatDateTime(notice.updatedAt)}</p>
        </div>
      </section>

      <div className="mt-6">
        <UpdateNoticeForm
          noticeId={notice.id}
          initialTitle={notice.title}
          initialBody={notice.body}
          initialType={notice.type}
          initialTopicTag={notice.topicTag ?? ""}
          initialHref={notice.href ?? ""}
          initialStatus={notice.status}
          initialDisplayDate={toDateTimeLocal(notice.displayDate)}
        />
      </div>
    </main>
  );
}
