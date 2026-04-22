import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isBlocked } from "@/lib/block";

// 友だちチェック
async function isFriend(userId1: string, userId2: string): Promise<boolean> {
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: userId1, addresseeId: userId2 },
        { requesterId: userId2, addresseeId: userId1 },
      ],
    },
  });
  return !!friendship;
}

// メッセージ履歴取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { userId } = await params;
  const myId = session.user.id;

  if (await isBlocked(myId, userId)) {
    return NextResponse.json({ error: "メッセージを送信できません" }, { status: 403 });
  }

  if (!(await isFriend(myId, userId))) {
    return NextResponse.json({ error: "友だちではありません" }, { status: 403 });
  }

  const cursor = request.nextUrl.searchParams.get("cursor");

  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: myId, recipientId: userId },
        { senderId: userId, recipientId: myId },
      ],
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  // 相手の情報
  const partner = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, avatarUrl: true },
  });

  return NextResponse.json({
    messages: messages.reverse(),
    partner,
    hasMore: messages.length === 50,
  });
}

// メッセージ送信
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { userId } = await params;
  const myId = session.user.id;

  if (myId === userId) {
    return NextResponse.json({ error: "自分にはメッセージを送れません" }, { status: 400 });
  }

  if (await isBlocked(myId, userId)) {
    return NextResponse.json({ error: "メッセージを送信できません" }, { status: 403 });
  }

  if (!(await isFriend(myId, userId))) {
    return NextResponse.json({ error: "友だちではありません" }, { status: 403 });
  }

  const { content } = await request.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "メッセージを入力してください" }, { status: 400 });
  }

  if (content.trim().length > 500) {
    return NextResponse.json({ error: "メッセージは500文字以内です" }, { status: 400 });
  }

  // レートリミット（10秒）
  const recent = await prisma.directMessage.findFirst({
    where: {
      senderId: myId,
      createdAt: { gte: new Date(Date.now() - 10000) },
    },
  });
  if (recent) {
    return NextResponse.json({ error: "少し時間をおいてから送信してください" }, { status: 429 });
  }

  const message = await prisma.directMessage.create({
    data: {
      senderId: myId,
      recipientId: userId,
      content: content.trim(),
    },
    include: {
      sender: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(message, { status: 201 });
}
