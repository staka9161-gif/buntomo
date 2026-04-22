import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
}
