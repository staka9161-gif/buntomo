import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { normalizeHandle } from "@/lib/handle";
import { getDisplayName } from "@/lib/user-display";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const raw = req.nextUrl.searchParams.get("handle") ?? "";
    if (!raw.trim()) {
      return NextResponse.json({ found: false });
    }

    const handle = normalizeHandle(raw);

    const user = await prisma.user.findUnique({
      where: { handle },
      select: { id: true, handle: true, name: true, image: true, deactivatedAt: true },
    });

    if (!user || user.deactivatedAt) {
      return NextResponse.json({ found: false });
    }

    const displayName = await getDisplayName(user.id);
    const myId = session.user.id;

    // 関係判定
    let relation: "self" | "friends" | "pending-sent" | "pending-received" | "none" = "none";
    if (user.id === myId) {
      relation = "self";
    } else {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: myId, addresseeId: user.id },
            { requesterId: user.id, addresseeId: myId },
          ],
        },
      });
      if (friendship) {
        if (friendship.status === "ACCEPTED") {
          relation = "friends";
        } else if (friendship.status === "PENDING") {
          relation = friendship.requesterId === myId ? "pending-sent" : "pending-received";
        }
      }
    }

    return NextResponse.json({
      found: true,
      user: {
        id: user.id,
        handle: user.handle,
        displayName: displayName ?? user.name,
        image: user.image,
      },
      relation,
    });
  } catch (e) {
    console.error("Search by handle error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
