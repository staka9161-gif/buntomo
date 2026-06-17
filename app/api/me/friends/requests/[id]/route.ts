import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveUser } from "@/lib/active-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const { id } = await params;
    const { action } = await request.json();

    if (!action || !["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "action は accept または reject で指定してください" },
        { status: 400 }
      );
    }

    const friendship = await prisma.friendship.findUnique({ where: { id } });

    if (!friendship || friendship.status !== "PENDING") {
      return NextResponse.json(
        { error: "申請が見つかりません" },
        { status: 404 }
      );
    }

    if (friendship.addresseeId !== activeUser.userId) {
      return NextResponse.json(
        { error: "権限がありません" },
        { status: 403 }
      );
    }

    const updated = await prisma.friendship.update({
      where: { id },
      data: { status: action === "accept" ? "ACCEPTED" : "REJECTED" },
    });

    if (action === "accept") {
      import("@/lib/notifications")
        .then(({ notifyFriendAccepted }) =>
          notifyFriendAccepted(activeUser.userId, friendship.requesterId)
        )
        .catch(() => {});
    }

    return NextResponse.json({ friendship: updated });
  } catch (e) {
    console.error("Friend request PATCH error:", e);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const { id } = await params;
    const friendship = await prisma.friendship.findUnique({ where: { id } });

    if (!friendship || friendship.status !== "PENDING") {
      return NextResponse.json(
        { error: "申請が見つかりません" },
        { status: 404 }
      );
    }

    if (friendship.requesterId !== activeUser.userId) {
      return NextResponse.json(
        { error: "権限がありません" },
        { status: 403 }
      );
    }

    await prisma.friendship.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Friend request DELETE error:", e);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
