import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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
}
