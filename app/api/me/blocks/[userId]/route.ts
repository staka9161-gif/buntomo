import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// ブロックする
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { userId } = await params;
    const myId = session.user.id;

    if (myId === userId) {
      return NextResponse.json({ error: "自分自身をブロックできません" }, { status: 400 });
    }

    const existing = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: myId, blockedId: userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "既にブロック済みです" }, { status: 409 });
    }

    // ブロックと同時に友だち関係を削除
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
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// ブロック解除
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

    await prisma.block.deleteMany({
      where: { blockerId: session.user.id, blockedId: userId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Block DELETE error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
