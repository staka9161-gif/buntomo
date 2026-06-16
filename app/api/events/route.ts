import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TOKYO_AREAS } from "@/lib/prefectures";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const prefecture = sp.get("prefecture") || "";
    const month = sp.get("month") || ""; // "2026-05" 形式

    // 未来のイベントのみ
    const where: Record<string, unknown> = {
      eventDate: { gte: new Date() },
      organizer: { deactivatedAt: null },
    };

    // 都道府県フィルタ（「東京都」は 23区+多摩地区 の両方を検索）
    if (prefecture) {
      if (prefecture === "東京都") {
        where.prefecture = { in: [...TOKYO_AREAS] };
      } else {
        where.prefecture = prefecture;
      }
    }

    // 月フィルタ
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const start = new Date(`${month}-01T00:00:00`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      where.eventDate = {
        ...(where.eventDate as object),
        gte: start > new Date() ? start : new Date(),
        lt: end,
      };
    }

    // フリーワード: タイトル or 本のタイトル or 場所
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { location: { contains: q } },
        { book: { title: { contains: q } } },
        { book: { author: { contains: q } } },
      ];
    }

    const events = await prisma.readingEvent.findMany({
      where,
      include: {
        book: { select: { id: true, title: true, author: true, coverImageUrl: true } },
        books: { select: { id: true, title: true, author: true, coverImageUrl: true } },
        organizer: { select: { id: true, name: true, image: true } },
      },
      orderBy: { eventDate: "asc" },
      take: 50,
    });

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        eventDate: e.eventDate.toISOString(),
        prefecture: e.prefecture,
        location: e.location,
        url: e.url,
        description: e.description,
        book: e.book,
        books: e.book
          ? [{ id: e.book.id, title: e.book.title, author: e.book.author, coverImageUrl: e.book.coverImageUrl }]
          : e.books.slice(0, 1).map(b => ({ id: b.id, title: b.title, author: b.author, coverImageUrl: b.coverImageUrl })),
        organizer: {
          id: e.organizer.id,
          name: e.organizer.name,
          image: e.organizer.image,
        },
      })),
    });
  } catch (e) {
    console.error("Events GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
