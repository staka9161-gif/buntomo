import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isBlocked } from "@/lib/block";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, deactivatedAt: true },
    });

    if (!targetUser || targetUser.deactivatedAt) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    const session = await auth();
    if (session?.user?.id && session.user.id !== userId && await isBlocked(session.user.id, userId)) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: {
          select: { id: true, handle: true, name: true, image: true, deactivatedAt: true },
        },
        addressee: {
          select: { id: true, handle: true, name: true, image: true, deactivatedAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const friends = friendships
      .map((friendship) => friendship.requesterId === userId ? friendship.addressee : friendship.requester)
      .filter((friend) => !friend.deactivatedAt)
      .map((friend) => ({
        id: friend.id,
        handle: friend.handle,
        name: friend.name,
        image: friend.image,
      }));

    const { getDisplayNames } = await import("@/lib/user-display");
    const displayNames = await getDisplayNames(friends.map((friend) => friend.id));
    const enrichedFriends = friends.map((friend) => ({
      ...friend,
      displayName: displayNames.get(friend.id) ?? friend.name,
    }));

    return NextResponse.json({
      user: targetUser,
      friends: enrichedFriends,
    });
  } catch (e) {
    console.error("User friends GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
