import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SuspensionAppealForm from "./SuspensionAppealForm";

export const metadata = {
  title: "アカウント利用停止中",
};

export default async function SuspendedAccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      accountStatus: true,
      deactivatedAt: true,
    },
  });

  if (!user || user.deactivatedAt) {
    redirect("/login");
  }

  if (user.accountStatus !== "suspended") {
    redirect("/mypage");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <h1 className="text-xl font-bold">このアカウントは現在利用停止中です</h1>
        <p className="mt-3 text-sm leading-6">
          現在、一部の操作と通常ページの利用を制限しています。解除や詳細について確認したい場合は、
          下のフォームから運営へ異議申し立てを送信できます。
        </p>
        <p className="mt-2 text-sm leading-6">
          管理者向けの停止理由はこの画面には表示しません。異議申し立てを送信しても、自動で停止が解除されることはありません。
        </p>
      </div>

      <div className="mt-6">
        <SuspensionAppealForm />
      </div>
    </main>
  );
}
