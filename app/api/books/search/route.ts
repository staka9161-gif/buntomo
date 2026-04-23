import { NextRequest, NextResponse } from "next/server";
import { searchBooks } from "@/lib/books-api";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q");
    if (!q) {
      return NextResponse.json({ error: "検索キーワードを入力してください" }, { status: 400 });
    }

    const debug = request.nextUrl.searchParams.get("debug") === "1";

    const results = await searchBooks(q);

    // イベント数を補完
    const bookDbIds = results.map((r) => r.bookDbId).filter(Boolean) as string[];
    const eventCountMap = new Map<string, number>();

    if (bookDbIds.length > 0) {
      const events = await prisma.readingEvent.findMany({
        where: {
          OR: [
            { bookId: { in: bookDbIds } },
            { books: { some: { id: { in: bookDbIds } } } },
          ],
          eventDate: { gte: new Date() },
        },
        select: {
          bookId: true,
          books: { select: { id: true } },
        },
      });
      for (const ev of events) {
        eventCountMap.set(ev.bookId, (eventCountMap.get(ev.bookId) ?? 0) + 1);
        for (const b of ev.books) {
          if (b.id !== ev.bookId) {
            eventCountMap.set(b.id, (eventCountMap.get(b.id) ?? 0) + 1);
          }
        }
      }
    }

    const booksOut = results.map((r) => {
      const eventCount = r.bookDbId ? eventCountMap.get(r.bookDbId) ?? 0 : 0;
      const base = {
        isbn: r.isbn,
        title: r.title,
        author: r.author,
        publisher: r.publisher,
        publishedDate: r.publishedDate,
        totalPages: r.totalPages,
        coverImageUrl: r.coverImageUrl,
        description: r.description,
        bookDbId: r.bookDbId,
        readingCount: r.readingCount,
        completedCount: r.completedCount,
        eventCount,
      };
      if (debug) {
        return {
          ...base,
          _debug: {
            customRank: r.customRank,
            publisherTier: r.publisherTier,
            matchScore: r._matchScore,
            finalScore: r._finalScore,
            label: r.label,
          },
        };
      }
      return base;
    });

    // DB書籍件数も返す（クライアントで状態把握用）
    const bookCount = await prisma.book.count();

    return NextResponse.json({
      books: booksOut,
      meta: {
        total: booksOut.length,
        dbBookCount: bookCount,
        source: bookCount > 1000 ? "local" : "external",
      },
    });
  } catch (e) {
    console.error("Book search error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
