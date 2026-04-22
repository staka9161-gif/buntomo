import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
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
      requester: { select: { id: true, displayName: true, avatarUrl: true, bio: true, area: true } },
      addressee: { select: { id: true, displayName: true, avatarUrl: true, bio: true, area: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const friends = friendships.map((f) => {
    const friend = f.requesterId === session.user!.id ? f.addressee : f.requester;
    return { ...friend, friendshipId: f.id, since: f.updatedAt };
  });

  return NextResponse.json({ friends });
}
