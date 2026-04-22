import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// ブロックリスト取得
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const blocks = await prisma.block.findMany({
    where: { blockerId: session.user.id },
    include: {
      blocked: { select: { id: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    blocks: blocks.map((b) => ({
      id: b.id,
      user: b.blocked,
      createdAt: b.createdAt,
    })),
  });
}
