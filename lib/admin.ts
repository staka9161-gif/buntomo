import { prisma } from "./db";
import { auth } from "./auth";

/**
 * ユーザーが管理者かどうかを確認する
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  return user?.isAdmin === true;
}

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false as const, status: 401 as const, error: "ログインが必要です" };
  }

  const admin = await isAdmin(session.user.id);

  if (!admin) {
    return { ok: false as const, status: 403 as const, error: "管理者権限が必要です" };
  }

  return { ok: true as const, userId: session.user.id };
}
