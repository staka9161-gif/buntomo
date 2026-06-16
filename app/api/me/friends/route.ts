import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: session.user.id },
          { addresseeId: session.user.id },
        ],
      },
      include: {
        requester: { select: { id: true, name: true, image: true, bio: true, area: true, deactivatedAt: true } },
        addressee: { select: { id: true, name: true, image: true, bio: true, area: true, deactivatedAt: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const friends = friendships
      .flatMap((f) => {
        const friend = f.requesterId === session.user!.id ? f.addressee : f.requester;
        if (friend.deactivatedAt) return [];
        return [{
          id: friend.id,
          name: friend.name,
          image: friend.image,
          bio: friend.bio,
          area: friend.area,
          friendshipId: f.id,
          since: f.updatedAt,
        }];
      });

    const { getDisplayNames } = await import("@/lib/user-display");
    const dn = await getDisplayNames(friends.map((f) => f.id));
    const enriched = friends.map((f) => ({ ...f, displayName: dn.get(f.id) ?? f.name }));

    return NextResponse.json({ friends: enriched });
  } catch (e) {
    console.error("Friends GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
