import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const status = request.nextUrl.searchParams.get("status");

    const readings = await prisma.readingStatus.findMany({
      where: {
        userId: session.user.id,
        ...(status ? { status: status.toUpperCase() as "READING" | "COMPLETED" | "WANT_TO_READ" } : {}),
      },
      include: { book: true },
      orderBy: { updatedAt: "desc" },
    });

    // 各書籍の読書中・読了カウント＋読書会数を取得
    const bookIds = readings.map((r) => r.bookId).filter((id): id is string => id != null);
    const counts = await prisma.readingStatus.groupBy({
      by: ["bookId", "status"],
      where: { bookId: { in: bookIds } },
      _count: true,
    });

    const countMap = new Map<string, { reading: number; completed: number }>();
    for (const c of counts) {
      if (!c.bookId) continue;
      const existing = countMap.get(c.bookId) || { reading: 0, completed: 0 };
      if (c.status === "READING") existing.reading = c._count;
      if (c.status === "COMPLETED") existing.completed = c._count;
      countMap.set(c.bookId, existing);
    }

    // 読書会数: bookId（主本）またはbooks（多対多）で紐づくイベントをカウント
    const eventCountMap = new Map<string, number>();
    if (bookIds.length > 0) {
      const eventsForBooks = await prisma.readingEvent.findMany({
        where: {
          OR: [
            { bookId: { in: bookIds } },
            { books: { some: { id: { in: bookIds } } } },
          ],
          eventDate: { gte: new Date() },
        },
        select: {
          bookId: true,
          books: { select: { id: true } },
        },
      });
      for (const ev of eventsForBooks) {
        // 主本にカウント
        if (ev.bookId && bookIds.includes(ev.bookId)) {
          eventCountMap.set(ev.bookId, (eventCountMap.get(ev.bookId) ?? 0) + 1);
        }
        // 多対多で紐づく本にもカウント
        for (const b of ev.books) {
          if (bookIds.includes(b.id) && b.id !== ev.bookId) {
            eventCountMap.set(b.id, (eventCountMap.get(b.id) ?? 0) + 1);
          }
        }
      }
    }

    const readingsWithCounts = readings.map((r) => ({
      ...r,
      readingCount: (r.bookId ? countMap.get(r.bookId)?.reading : 0) ?? 0,
      completedCount: (r.bookId ? countMap.get(r.bookId)?.completed : 0) ?? 0,
      eventCount: (r.bookId ? eventCountMap.get(r.bookId) : 0) ?? 0,
    }));

    return NextResponse.json({ readings: readingsWithCounts });
  } catch (e) {
    console.error("Readings GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { bookId, status } = await request.json();

    if (!bookId || !status) {
      return NextResponse.json({ error: "bookId と status は必須です" }, { status: 400 });
    }

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
    }

    const existing = await prisma.readingStatus.findUnique({
      where: { userId_bookId: { userId: session.user.id, bookId } },
    });
    if (existing) {
      return NextResponse.json({ error: "既にこの本は登録されています" }, { status: 409 });
    }

    const reading = await prisma.readingStatus.create({
      data: {
        userId: session.user.id,
        bookId,
        status: status.toUpperCase(),
        startedAt: status.toUpperCase() === "READING" ? new Date() : null,
        completedAt: status.toUpperCase() === "COMPLETED" ? new Date() : null,
      },
      include: { book: true },
    });

    return NextResponse.json({ reading }, { status: 201 });
  } catch (e) {
    console.error("Readings POST error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
