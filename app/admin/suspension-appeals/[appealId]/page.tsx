import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import SuspensionAppealStatusForm from "./SuspensionAppealStatusForm";

type AdminSuspensionAppealDetailPageProps = {
  params: Promise<{ appealId: string }>;
};

const statusLabels: Record<string, string> = {
  pending: "未対応",
  reviewing: "確認中",
  resolved: "確認済み",
  rejected: "却下",
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export default async function AdminSuspensionAppealDetailPage({
  params,
}: AdminSuspensionAppealDetailPageProps) {
  const { appealId } = await params;
  const appeal = await prisma.suspensionAppeal.findUnique({
    where: { id: appealId },
    select: {
      id: true,
      status: true,
      message: true,
      adminNote: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
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
  });

  if (!appeal) {
    notFound();
  }

  const userAdminHref = appeal.user ? `/admin/users/${appeal.user.id}` : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="border-b pb-5">
        <p className="text-sm text-gray-500">
          <Link href="/admin" className="hover:text-amber-700 hover:underline">
            管理画面
          </Link>
          <span className="mx-2">/</span>
          <Link href="/admin/suspension-appeals" className="hover:text-amber-700 hover:underline">
            停止異議申し立て
          </Link>
          <span className="mx-2">/</span>
          詳細
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">停止異議申し立て詳細</h1>
        <p className="mt-2 text-sm text-gray-500">
          申し立ての内容を確認し、確認状況を記録します。停止解除はこの画面では行いません。
        </p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">基本情報</h2>
            <dl className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="申し立てID">{appeal.id}</Field>
              <Field label="status">{statusLabels[appeal.status] ?? appeal.status}</Field>
              <Field label="送信日時">{formatDateTime(appeal.createdAt)}</Field>
              <Field label="更新日時">{formatDateTime(appeal.updatedAt)}</Field>
              <Field label="完了日時">{formatDateTime(appeal.resolvedAt)}</Field>
              <Field label="対象ユーザー">
                <div className="space-y-1">
                  <UserLabel user={appeal.user} fallback="削除済みユーザー" />
                  {userAdminHref ? (
                    <Link
                      href={userAdminHref}
                      className="block text-xs font-semibold text-amber-700 hover:underline"
                    >
                      ユーザー管理画面を開く
                    </Link>
                  ) : null}
                </div>
              </Field>
              <Field label="対象ユーザー状態">
                {appeal.user?.deactivatedAt
                  ? "退会済み"
                  : appeal.user?.accountStatus === "suspended"
                    ? "停止中"
                    : appeal.user
                      ? "利用中"
                      : "-"}
              </Field>
              <Field label="最終対応管理者">
                <UserLabel user={appeal.adminUser} fallback="-" />
              </Field>
            </dl>

            <div className="mt-4">
              <h3 className="text-xs font-semibold text-gray-500">申し立て本文</h3>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-900">
                {appeal.message}
              </p>
            </div>

            {userAdminHref ? (
              <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                アカウント停止の解除や継続判断は
                <Link href={userAdminHref} className="mx-1 font-semibold underline">
                  ユーザー管理画面
                </Link>
                で行ってください。
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">管理メモ</h2>
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-900">
              {appeal.adminNote || "-"}
            </p>
          </section>
        </div>

        <SuspensionAppealStatusForm
          appealId={appeal.id}
          initialStatus={appeal.status}
          initialAdminNote={appeal.adminNote ?? ""}
        />
      </div>
    </main>
  );
}
