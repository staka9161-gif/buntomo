import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isBlocked } from "@/lib/block";
import { requireActiveUser } from "@/lib/active-user";

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

async function getActivePartner(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, deactivatedAt: null },
    select: { id: true, name: true, image: true },
  });
}

// メッセージ履歴取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { userId } = await params;
    const myId = session.user.id;

    const partner = await getActivePartner(userId);
    if (!partner) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

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
        sender: { select: { id: true, name: true, image: true } },
      },
    });

    const { getDisplayNames } = await import("@/lib/user-display");
    const allIds = [...new Set([...messages.map((m) => m.sender.id), partner.id])];
    const dn = await getDisplayNames(allIds);
    const enrichedMessages = messages.reverse().map((m) => ({
      ...m,
      sender: { ...m.sender, displayName: dn.get(m.sender.id) ?? m.sender.name },
    }));
    const enrichedPartner = { ...partner, displayName: dn.get(partner.id) ?? partner.name };
    return NextResponse.json({
      messages: enrichedMessages,
      partner: enrichedPartner,
      hasMore: messages.length === 50,
    });
  } catch (e) {
    console.error("DM messages GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// メッセージ送信
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
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

    const { userId } = await params;
    const myId = activeUser.userId;

    if (myId === userId) {
      return NextResponse.json({ error: "自分にはメッセージを送れません" }, { status: 400 });
    }

    const partner = await getActivePartner(userId);
    if (!partner) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
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

    // 通知チェックはメッセージ作成前に行う（未読の存在で判定するため）
    const { notifyDMReceived } = await import("@/lib/notifications");
    const trimmedContent = content.trim();
    const shouldNotify = notifyDMReceived(myId, userId, trimmedContent);

    const message = await prisma.directMessage.create({
      data: {
        senderId: myId,
        recipientId: userId,
        content: trimmedContent,
      },
      include: {
        sender: { select: { id: true, name: true, image: true } },
      },
    });

    // fire-and-forget: メール失敗が DM 操作を妨げない
    shouldNotify.catch(() => {});

    return NextResponse.json(message, { status: 201 });
  } catch (e) {
    console.error("DM POST error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
