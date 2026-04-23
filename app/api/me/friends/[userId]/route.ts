import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { userId } = await params;

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: session.user.id, addresseeId: userId },
          { requesterId: userId, addresseeId: session.user.id },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json({ error: "友だち関係が見つかりません" }, { status: 404 });
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Friend DELETE error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
