import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { calculateProgress } from "@/types";
import { getBlockedUserIds } from "@/lib/block";
import { getDisplayNames } from "@/lib/user-display";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
    }

    const readings = await prisma.readingStatus.findMany({
      where: { bookId: id, status: "READING" },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    // ブロック関係のユーザーを除外
    const session = await auth();
    const blockedIds = session?.user?.id ? await getBlockedUserIds(session.user.id) : new Set<string>();

    const filtered = readings.filter((r) => !blockedIds.has(r.user.id));
    const displayNames = await getDisplayNames(filtered.map((r) => r.user.id));
    const users = filtered.map((r) => ({
        userId: r.user.id,
        name: r.user.name,
        displayName: displayNames.get(r.user.id) ?? r.user.name,
        image: r.user.image,
        currentPage: r.currentPage,
        progressPercent: calculateProgress(r.currentPage, book.totalPages),
      }));

    return NextResponse.json({ users });
  } catch (e) {
    console.error("Currently reading GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
