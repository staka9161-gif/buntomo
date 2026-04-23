import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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

    let readingCount = 0;
    let completedCount = 0;
    for (const c of counts) {
      if (c.status === "READING") readingCount = c._count;
      if (c.status === "COMPLETED") completedCount = c._count;
    }

    return NextResponse.json({ book, readingCount, completedCount, eventCount });
  } catch (e) {
    console.error("Book detail GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
    }

    const updated = await prisma.book.update({
      where: { id },
      data: { totalPages: body.totalPages },
    });

    return NextResponse.json({ book: updated });
  } catch (e) {
    console.error("Book PATCH error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
