import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

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

const plannedItems = ["通報確認", "重要なお知らせ"];

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

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="border-b pb-5">
        <h1 className="text-2xl font-bold text-gray-900">管理画面</h1>
        <p className="mt-2 text-sm text-gray-500">
          管理者向けの確認・運用メニューです。
        </p>
      </div>

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
