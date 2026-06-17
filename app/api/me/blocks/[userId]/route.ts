import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveUser } from "@/lib/active-user";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const { userId } = await params;
    const myId = activeUser.userId;

    if (myId === userId) {
      return NextResponse.json(
        { error: "自分自身をブロックできません" },
        { status: 400 }
      );
    }

    const existing = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: myId, blockedId: userId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "既にブロック済みです" },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.block.create({
        data: { blockerId: myId, blockedId: userId },
      }),
      prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: myId, addresseeId: userId },
            { requesterId: userId, addresseeId: myId },
          ],
        },
      }),
    ]);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    console.error("Block POST error:", e);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

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

    await prisma.block.deleteMany({
      where: { blockerId: activeUser.userId, blockedId: userId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Block DELETE error:", e);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
