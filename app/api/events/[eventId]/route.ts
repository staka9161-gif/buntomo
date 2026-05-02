import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { eventId } = await params;
    const event = await prisma.readingEvent.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "読書会が見つかりません" }, { status: 404 });
    }
    if (event.organizerId !== session.user.id) {
      return NextResponse.json({ error: "登録者のみ編集できます" }, { status: 403 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
      }
      if (body.title.trim().length > 20) {
        return NextResponse.json({ error: "タイトルは20文字以内にしてください" }, { status: 400 });
      }
      updateData.title = body.title.trim();
    }
    if (body.eventDate !== undefined) {
      const date = new Date(body.eventDate);
      if (date <= new Date()) {
        return NextResponse.json({ error: "開催日時は未来の日時を指定してください" }, { status: 400 });
      }
      updateData.eventDate = date;
    }
    if (body.prefecture !== undefined) {
      updateData.prefecture = body.prefecture;
    }
    if (body.location !== undefined) {
      if (!body.location.trim()) {
        return NextResponse.json({ error: "場所は必須です" }, { status: 400 });
      }
      if (body.location.trim().length > 25) {
        return NextResponse.json({ error: "場所は25文字以内にしてください" }, { status: 400 });
      }
      updateData.location = body.location.trim();
    }
    if (body.url !== undefined) {
      if (!body.url?.trim()) {
        return NextResponse.json({ error: "参加リンクは必須です" }, { status: 400 });
      }
      updateData.url = body.url.trim();
    }
    if (body.description !== undefined) {
      if (body.description && body.description.trim().length > 40) {
        return NextResponse.json({ error: "備考は40文字以内にしてください" }, { status: 400 });
      }
      updateData.description = body.description?.trim() || null;
    }

    // 対象書籍の更新
    if (Array.isArray(body.bookIds) && body.bookIds.length > 0) {
      const newBookIds: string[] = [...new Set([event.bookId, ...body.bookIds].filter((id): id is string => id != null))];
      updateData.books = { set: newBookIds.map((bid: string) => ({ id: bid })) };
    }

    const updated = await prisma.readingEvent.update({
      where: { id: eventId },
      data: updateData,
      include: {
        organizer: { select: { id: true, displayName: true, avatarUrl: true } },
        books: { select: { id: true, title: true, author: true, coverImageUrl: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      eventDate: updated.eventDate.toISOString(),
      prefecture: updated.prefecture,
      location: updated.location,
      url: updated.url,
      description: updated.description,
      organizer: {
        id: updated.organizer.id,
        displayName: updated.organizer.displayName,
        avatarUrl: updated.organizer.avatarUrl,
      },
      books: updated.books.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        coverImageUrl: b.coverImageUrl,
      })),
    });
  } catch (e) {
    console.error("Event PATCH error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { eventId } = await params;
    const event = await prisma.readingEvent.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "読書会が見つかりません" }, { status: 404 });
    }
    if (event.organizerId !== session.user.id) {
      return NextResponse.json({ error: "登録者のみ削除できます" }, { status: 403 });
    }

    await prisma.readingEvent.delete({ where: { id: eventId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Event DELETE error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
