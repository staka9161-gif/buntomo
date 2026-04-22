import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { id } = await params;
  const { action } = await request.json();

  if (!action || !["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "action は accept または reject です" }, { status: 400 });
  }

  const friendship = await prisma.friendship.findUnique({ where: { id } });

  if (!friendship || friendship.status !== "PENDING") {
    return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
  }

  // 承認/拒否できるのは受信者のみ
  if (friendship.addresseeId !== session.user.id) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: action === "accept" ? "ACCEPTED" : "REJECTED" },
  });

  return NextResponse.json({ friendship: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { id } = await params;
  const friendship = await prisma.friendship.findUnique({ where: { id } });

  if (!friendship || friendship.status !== "PENDING") {
    return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
  }

  // キャンセルできるのは送信者のみ
  if (friendship.requesterId !== session.user.id) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  await prisma.friendship.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
