import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { normalizeText, katakanaToHiragana, removeSymbols } from "@/lib/normalize";
import { parseEventDate } from "@/lib/date-utils";
import { requireActiveUser } from "@/lib/active-user";

// タイトルから巻数・版表記を除去して基本タイトルを抽出
function extractBaseTitle(title: string): string {
  let t = title;
  t = t.replace(/[\s　]*[\(（【\[]?(?:上|下|[上下]巻|第?\d+[巻号冊部編]?|[ⅠⅡⅢⅣⅤ]|[①②③④⑤⑥⑦⑧⑨⑩])[\)）】\]]?\s*$/, "");
  t = t.replace(/[\s　]*(?:新装版|文庫版|改訂版|増補版|完全版|愛蔵版|新版|復刊版|ワイド版)\s*$/, "");
  return t.trim();
}

// 開催予定の読書会を取得（同タイトル別版のイベントも含む）
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const book = await prisma.book.findUnique({ where: { id } });

    // 同タイトル別版のbookIdも収集
    const bookIds = [id];
    if (book) {
      const baseTitle = extractBaseTitle(book.title);
      const normalizedBase = removeSymbols(normalizeText(baseTitle)).toLowerCase();
      const normalizedBaseH = katakanaToHiragana(normalizedBase);

      const candidates = await prisma.book.findMany({
        where: {
          id: { not: id },
          title: { contains: baseTitle },
        },
        select: { id: true, title: true },
        take: 20,
      });

      for (const c of candidates) {
        const cBase = removeSymbols(normalizeText(extractBaseTitle(c.title))).toLowerCase();
        const cBaseH = katakanaToHiragana(cBase);
        if (
          cBase === normalizedBase ||
          cBaseH === normalizedBaseH ||
          cBase.startsWith(normalizedBase) ||
          cBaseH.startsWith(normalizedBaseH) ||
          normalizedBase.startsWith(cBase) ||
          normalizedBaseH.startsWith(cBaseH)
        ) {
          bookIds.push(c.id);
        }
      }
    }

    // booksリレーション（多対多）またはbookId（主本）で検索
    const events = await prisma.readingEvent.findMany({
      where: {
        OR: [
          { bookId: { in: bookIds } },
          { books: { some: { id: { in: bookIds } } } },
        ],
        organizer: { deactivatedAt: null },
        eventDate: { gte: new Date() },
      },
      include: {
        organizer: { select: { id: true, name: true, image: true } },
        book: { select: { id: true, title: true, author: true, coverImageUrl: true } },
        books: { select: { id: true, title: true, author: true, coverImageUrl: true } },
      },
      orderBy: { eventDate: "asc" },
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
        organizer: {
          id: e.organizer.id,
          name: e.organizer.name,
          image: e.organizer.image,
        },
        books: e.book
          ? [{ id: e.book.id, title: e.book.title, author: e.book.author, coverImageUrl: e.book.coverImageUrl }]
          : e.books.slice(0, 1).map(b => ({ id: b.id, title: b.title, author: b.author, coverImageUrl: b.coverImageUrl })),
        isOtherEdition: e.bookId !== id && !e.books.some((b) => b.id === id),
      })),
    });
  } catch (e) {
    console.error("Book events GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// 読書会を作成
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }
    const myId = activeUser.userId;

    const { id } = await params;
    const { title, eventDate, prefecture, location, url, description, bookIds } = await request.json();

    if (!title?.trim() || !eventDate || !prefecture || !location?.trim() || !url?.trim()) {
      return NextResponse.json(
        { error: "タイトル、日時、都道府県、場所、参加リンクは必須です" },
        { status: 400 }
      );
    }
    if (title.trim().length > 20) {
      return NextResponse.json({ error: "タイトルは20文字以内にしてください" }, { status: 400 });
    }
    if (location.trim().length > 25) {
      return NextResponse.json({ error: "場所は25文字以内にしてください" }, { status: 400 });
    }
    if (description && description.trim().length > 40) {
      return NextResponse.json({ error: "備考は40文字以内にしてください" }, { status: 400 });
    }

    const date = parseEventDate(eventDate);
    if (date <= new Date()) {
      return NextResponse.json(
        { error: "開催日時は未来の日時を指定してください" },
        { status: 400 }
      );
    }

    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
    }

    // 対象書籍のID一覧: bookIds が渡されればそれを使用、なければ主本のみ
    const allBookIds: string[] = Array.isArray(bookIds) && bookIds.length > 0
      ? [...new Set([id, ...bookIds])]
      : [id];

    const event = await prisma.readingEvent.create({
      data: {
        bookId: id,
        organizerId: myId,
        title: title.trim(),
        eventDate: date,
        prefecture,
        location: location.trim(),
        url: url.trim(),
        description: description?.trim() || null,
        books: { connect: allBookIds.map((bid) => ({ id: bid })) },
      },
      include: {
        organizer: { select: { id: true, name: true, image: true } },
        books: { select: { id: true, title: true, author: true, coverImageUrl: true } },
      },
    });

    return NextResponse.json(
      {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate.toISOString(),
        prefecture: event.prefecture,
        location: event.location,
        url: event.url,
        description: event.description,
        organizer: {
          id: event.organizer.id,
          name: event.organizer.name,
          image: event.organizer.image,
        },
        books: event.books.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          coverImageUrl: b.coverImageUrl,
        })),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("Book event POST error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
