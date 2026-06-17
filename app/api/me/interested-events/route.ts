import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1") || 1);
    const requestedPageSize = Number(request.nextUrl.searchParams.get("pageSize") || DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedPageSize));
    const skip = (page - 1) * pageSize;

    const where = {
      userId: session.user.id,
      event: {
        organizer: { deactivatedAt: null },
      },
    };

    const [total, interests] = await Promise.all([
      prisma.readingEventInterest.count({ where }),
      prisma.readingEventInterest.findMany({
        where,
        include: {
          event: {
            include: {
              organizer: { select: { id: true, name: true, handle: true, image: true } },
              book: { select: { id: true, title: true, author: true, coverImageUrl: true } },
              books: { select: { id: true, title: true, author: true, coverImageUrl: true } },
              work: { select: { id: true, title: true, author: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      events: interests.map((interest) => {
        const event = interest.event;
        const books = event.book
          ? [{ id: event.book.id, title: event.book.title, author: event.book.author, coverImageUrl: event.book.coverImageUrl }]
          : event.books.map((book) => ({
              id: book.id,
              title: book.title,
              author: book.author,
              coverImageUrl: book.coverImageUrl,
            }));

        return {
          id: event.id,
          title: event.title,
          eventDate: event.eventDate.toISOString(),
          prefecture: event.prefecture,
          location: event.location,
          url: event.url,
          description: event.description,
          createdAt: event.createdAt.toISOString(),
          interestedAt: interest.createdAt.toISOString(),
          book: event.book
            ? {
                id: event.book.id,
                title: event.book.title,
                author: event.book.author,
                coverImageUrl: event.book.coverImageUrl,
              }
            : null,
          books,
          work: event.work
            ? {
                id: event.work.id,
                title: event.work.title,
                author: event.work.author,
              }
            : null,
          organizer: {
            id: event.organizer.id,
            name: event.organizer.name,
            handle: event.organizer.handle,
            image: event.organizer.image,
          },
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error("Interested events GET error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
