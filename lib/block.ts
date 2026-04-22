import { prisma } from "./db";

// どちらかがブロックしていればtrue（双方向チェック）
export async function isBlocked(userId1: string, userId2: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  });
  return !!block;
}

// 指定ユーザーとブロック関係にあるユーザーIDの一覧を返す
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const blocks = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const b of blocks) {
    if (b.blockerId === userId) ids.add(b.blockedId);
    else ids.add(b.blockerId);
  }
  return ids;
}
