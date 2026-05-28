import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const myId = session.user.id;

    const [dmCount, friendRequestCount] = await Promise.all([
      prisma.directMessage.count({
        where: { recipientId: myId, read: false },
      }),
      prisma.friendship.count({
        where: { addresseeId: myId, status: "PENDING" },
      }),
    ]);

    return NextResponse.json({
      dmCount,
      friendRequestCount,
      total: dmCount + friendRequestCount,
    });
  } catch (e) {
    console.error("Notification counts error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
