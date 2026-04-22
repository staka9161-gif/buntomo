import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { calculateProgress } from "@/types";
import { getBlockedUserIds } from "@/lib/block";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) {
    return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
  }

  const readings = await prisma.readingStatus.findMany({
    where: { bookId: id, status: "READING" },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  // ブロック関係のユーザーを除外
  const session = await auth();
  const blockedIds = session?.user?.id ? await getBlockedUserIds(session.user.id) : new Set<string>();

  const users = readings
    .filter((r) => !blockedIds.has(r.user.id))
    .map((r) => ({
      userId: r.user.id,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
      currentPage: r.currentPage,
      progressPercent: calculateProgress(r.currentPage, book.totalPages),
    }));

  return NextResponse.json({ users });
}
