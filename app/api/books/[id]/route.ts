import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function findExistingWorkId(workId: string | null | undefined) {
  if (!workId) return null;
  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { id: true },
  });
  return work?.id ?? null;
}

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

    const [counts, eventCount] = await Promise.all([
      prisma.readingStatus.groupBy({
        by: ["status"],
        where: { bookId: id },
        _count: true,
      }),
      prisma.readingEvent.count({
        where: {
          OR: [
            { bookId: id },
            { books: { some: { id } } },
          ],
          eventDate: { gte: new Date() },
        },
      }),
    ]);
    const migratedWorkId = await findExistingWorkId(book.migratedWorkId);

    let readingCount = 0;
    let completedCount = 0;
    for (const c of counts) {
      if (c.status === "READING") readingCount = c._count;
      if (c.status === "COMPLETED") completedCount = c._count;
    }

    return NextResponse.json({
      book: {
        ...book,
        migratedWorkId,
      },
      readingCount,
      completedCount,
      eventCount,
      migratedWorkId,
    });
  } catch (e) {
    console.error("Book detail GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "共有の書籍情報は変更できません。画面を再読み込みし、読書記録の総ページ数を更新してください" },
      { status: 405, headers: { Allow: "GET" } }
    );
  } catch (e) {
    console.error("Book PATCH error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
