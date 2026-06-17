import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import AnnouncementForm from "./AnnouncementForm";

type AdminAnnouncementDetailPageProps = {
  params: Promise<{ announcementId: string }>;
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

export default async function AdminAnnouncementDetailPage({
  params,
}: AdminAnnouncementDetailPageProps) {
  const { announcementId } = await params;
  const announcement = await prisma.importantAnnouncement.findUnique({
    where: { id: announcementId },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      level: true,
      publishedAt: true,
      expiresAt: true,
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

  if (!announcement) {
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
          <Link href="/admin/announcements" className="hover:text-amber-700 hover:underline">
            重要なお知らせ
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{announcement.title}</h1>
        <p className="mt-2 text-sm text-gray-500">
          重要なお知らせの内容と公開状態を編集します。削除機能はありません。
        </p>
      </div>

      <section className="mt-6 grid gap-4 rounded-lg border bg-white p-5 text-sm shadow-sm md:grid-cols-2">
        <div>
          <span className="font-semibold text-gray-600">status</span>
          <p className="mt-1 text-gray-900">{announcement.status}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">level</span>
          <p className="mt-1 text-gray-900">{announcement.level}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">公開日時</span>
          <p className="mt-1 text-gray-900">{formatDateTime(announcement.publishedAt)}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">終了日時</span>
          <p className="mt-1 text-gray-900">{formatDateTime(announcement.expiresAt)}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">作成者</span>
          <p className="mt-1 text-gray-900">
            <UserLabel user={announcement.createdBy} fallback="削除済み管理者" />
          </p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">最終更新者</span>
          <p className="mt-1 text-gray-900">
            <UserLabel user={announcement.updatedBy} fallback="削除済み管理者" />
          </p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">作成日時</span>
          <p className="mt-1 text-gray-900">{formatDateTime(announcement.createdAt)}</p>
        </div>
        <div>
          <span className="font-semibold text-gray-600">更新日時</span>
          <p className="mt-1 text-gray-900">{formatDateTime(announcement.updatedAt)}</p>
        </div>
      </section>

      <div className="mt-6">
        <AnnouncementForm
          announcementId={announcement.id}
          initialTitle={announcement.title}
          initialBody={announcement.body}
          initialLevel={announcement.level}
          initialStatus={announcement.status}
          initialExpiresAt={toDateTimeLocal(announcement.expiresAt)}
        />
      </div>
    </main>
  );
}
