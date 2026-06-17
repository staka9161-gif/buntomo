import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveUser } from "@/lib/active-user";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const { userId } = await params;

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: activeUser.userId, addresseeId: userId },
          { requesterId: userId, addresseeId: activeUser.userId },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "友だち関係が見つかりません" },
        { status: 404 }
      );
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Friend DELETE error:", e);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
