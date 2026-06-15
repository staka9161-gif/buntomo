import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isBlocked } from "@/lib/block";
import { parseVisibility } from "@/lib/visibility";

type ReadingFilter = "READING" | "COMPLETED";

async function getViewerState(userId: string) {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, visibility: true, deactivatedAt: true },
  });

  if (!targetUser || targetUser.deactivatedAt) {
    return { status: "not-found" as const };
  }

  const session = await auth();
  let isMe = false;
  let isFriend = false;

  if (session?.user?.id) {
    if (session.user.id === userId) {
      isMe = true;
    } else if (await isBlocked(session.user.id, userId)) {
      return { status: "not-found" as const };
    } else {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { requesterId: session.user.id, addresseeId: userId },
            { requesterId: userId, addresseeId: session.user.id },
          ],
        },
        select: { id: true },
      });
      isFriend = !!friendship;
    }
  }

  const visibility = parseVisibility(targetUser.visibility);
  const canSeeReadings = isMe || visibility.readings === "public" || (visibility.readings === "friends" && isFriend);

  return { status: "ok" as const, targetUser, canSeeReadings };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const statusParam = request.nextUrl.searchParams.get("status");
    const statusMap: Record<string, ReadingFilter> = {
      reading: "READING",
      completed: "COMPLETED",
    };
    const status = statusParam ? statusMap[statusParam] : undefined;

    if (!status) {
      return NextResponse.json({ error: "status は reading または completed を指定してください" }, { status: 400 });
    }

    const viewerState = await getViewerState(userId);
    if (viewerState.status === "not-found") {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    if (!viewerState.canSeeReadings) {
      return NextResponse.json({
        user: { id: viewerState.targetUser.id, name: viewerState.targetUser.name },
        private: true,
        readings: [],
      });
    }

    const readings = await prisma.readingStatus.findMany({
      where: { userId, status },
      include: {
        book: {
          select: { id: true, title: true, author: true, totalPages: true, coverImageUrl: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const bookIds = readings.map((r) => r.bookId).filter((id): id is string => id != null);
    const [counts, eventsForBooks] = await Promise.all([
      bookIds.length > 0
        ? prisma.readingStatus.groupBy({
            by: ["bookId", "status"],
            where: { bookId: { in: bookIds } },
            _count: true,
          })
        : Promise.resolve([]),
      bookIds.length > 0
        ? prisma.readingEvent.findMany({
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
          })
        : Promise.resolve([]),
    ]);

    const countMap = new Map<string, { reading: number; completed: number }>();
    for (const c of counts) {
      if (!c.bookId) continue;
      const existing = countMap.get(c.bookId) || { reading: 0, completed: 0 };
      if (c.status === "READING") existing.reading = c._count;
      if (c.status === "COMPLETED") existing.completed = c._count;
      countMap.set(c.bookId, existing);
    }

    const eventCountMap = new Map<string, number>();
    for (const event of eventsForBooks) {
      if (event.bookId && bookIds.includes(event.bookId)) {
        eventCountMap.set(event.bookId, (eventCountMap.get(event.bookId) ?? 0) + 1);
      }
      for (const book of event.books) {
        if (bookIds.includes(book.id) && book.id !== event.bookId) {
          eventCountMap.set(book.id, (eventCountMap.get(book.id) ?? 0) + 1);
        }
      }
    }

    const readingsWithCounts = readings
      .filter((r) => r.book)
      .map((r) => ({
        ...r,
        readingCount: (r.bookId ? countMap.get(r.bookId)?.reading : 0) ?? 0,
        completedCount: (r.bookId ? countMap.get(r.bookId)?.completed : 0) ?? 0,
        eventCount: (r.bookId ? eventCountMap.get(r.bookId) : 0) ?? 0,
      }));

    return NextResponse.json({
      user: { id: viewerState.targetUser.id, name: viewerState.targetUser.name },
      private: false,
      readings: readingsWithCounts,
    });
  } catch (e) {
    console.error("User readings GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
