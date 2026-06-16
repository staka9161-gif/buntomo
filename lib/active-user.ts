import { auth } from "./auth";
import { prisma } from "./db";

export async function requireActiveUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return { ok: false as const, status: 401 as const, error: "ログインが必要です" };
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
    return { ok: false as const, status: 401 as const, error: "ログインが必要です" };
  }

  if (user.accountStatus === "suspended") {
    return {
      ok: false as const,
      status: 403 as const,
      error: "このアカウントは現在利用停止中です。",
    };
  }

  return { ok: true as const, userId: user.id };
}
