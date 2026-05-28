import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { windowToMs, type WindowType } from "@/types";
import { getBlockedUserIds } from "@/lib/block";

const VALID_WINDOWS: WindowType[] = ["1d", "1w", "all"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const windowParam = (request.nextUrl.searchParams.get("window") || "1w") as WindowType;
    const window = VALID_WINDOWS.includes(windowParam) ? windowParam : "1w";

    const cutoff = new Date(Date.now() - windowToMs(window));

    // 期間内に読了したユーザーのIDを取得
    const completedReadings = await prisma.readingStatus.findMany({
      where: {
        bookId: id,
        status: "COMPLETED",
        completedAt: { gte: cutoff },
      },
      select: { userId: true },
    });
    const userIds = completedReadings.map((r) => r.userId);

    // そのウィンドウのメッセージのみ取得
    const messages = await prisma.chatMessage.findMany({
      where: {
        bookId: id,
        window,
      },
      include: {
        user: { select: { name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // ログインユーザーが投稿可能かチェック + ブロックユーザー除外
    const session = await auth();
    let canPost = false;
    const blockedIds = session?.user?.id ? await getBlockedUserIds(session.user.id) : new Set<string>();
    if (session?.user?.id) {
      canPost = userIds.includes(session.user.id);
    }

    const filteredMsgs = messages.filter((m) => !blockedIds.has(m.userId));
    const { getDisplayNames } = await import("@/lib/user-display");
    const chatDisplayNames = await getDisplayNames(filteredMsgs.map((m) => m.userId));
    return NextResponse.json({
      window,
      messages: filteredMsgs.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          displayName: chatDisplayNames.get(m.userId) ?? m.user.name,
          image: m.user.image,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
      canPost,
    });
  } catch (e) {
    console.error("Chat GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { id } = await params;
    const { content, window: windowParam } = await request.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "メッセージを入力してください" }, { status: 400 });
    }

    const window: WindowType = VALID_WINDOWS.includes(windowParam) ? windowParam : "1w";
    const cutoff = new Date(Date.now() - windowToMs(window));

    // 投稿権限チェック
    const reading = await prisma.readingStatus.findUnique({
      where: { userId_bookId: { userId: session.user.id, bookId: id } },
    });

    if (
      !reading ||
      reading.status !== "COMPLETED" ||
      !reading.completedAt ||
      reading.completedAt < cutoff
    ) {
      return NextResponse.json(
        { error: "選択した期間内にこの本を読了していないため、投稿できません" },
        { status: 403 }
      );
    }

    // レート制限: 10秒以内の連投チェック
    const recentMessage = await prisma.chatMessage.findFirst({
      where: {
        bookId: id,
        userId: session.user.id,
        createdAt: { gte: new Date(Date.now() - 10000) },
      },
    });
    if (recentMessage) {
      return NextResponse.json(
        { error: "投稿間隔が短すぎます。10秒以上空けてください" },
        { status: 429 }
      );
    }

    const message = await prisma.chatMessage.create({
      data: {
        bookId: id,
        userId: session.user.id,
        content: content.trim(),
        window,
      },
      include: {
        user: { select: { name: true, image: true } },
      },
    });

    const { getDisplayName } = await import("@/lib/user-display");
    const postDisplayName = await getDisplayName(message.userId);
    return NextResponse.json({
      id: message.id,
      userId: message.userId,
      name: message.user.name,
      displayName: postDisplayName ?? message.user.name,
      image: message.user.image,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    }, { status: 201 });
  } catch (e) {
    console.error("Chat POST error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
