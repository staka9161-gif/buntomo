import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getBlockedUserIds } from "@/lib/block";

// DM会話一覧（相手ごとの最新メッセージ）
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const myId = session.user.id;

    // 自分が送信or受信した全DMを取得（新しい順）
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: myId }, { recipientId: myId }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        recipient: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // 相手ごとにグルーピングして最新メッセージだけ取得
    const conversationMap = new Map<string, {
      user: { id: string; displayName: string; avatarUrl: string | null };
      lastMessage: string;
      lastMessageAt: string;
      isMe: boolean;
    }>();

    const blockedIds = await getBlockedUserIds(myId);

    for (const msg of messages) {
      const partnerId = msg.senderId === myId ? msg.recipientId : msg.senderId;
      if (blockedIds.has(partnerId)) continue;
      if (conversationMap.has(partnerId)) continue;

      const partner = msg.senderId === myId ? msg.recipient : msg.sender;
      conversationMap.set(partnerId, {
        user: partner,
        lastMessage: msg.content,
        lastMessageAt: msg.createdAt.toISOString(),
        isMe: msg.senderId === myId,
      });
    }

    const conversations = [...conversationMap.values()];

    return NextResponse.json({ conversations });
  } catch (e) {
    console.error("DMs GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
