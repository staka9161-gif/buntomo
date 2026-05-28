import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseVisibility } from "@/lib/visibility";
import { isBlocked } from "@/lib/block";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
        bio: true,
        area: true,
        linkX: true,
        linkInstagram: true,
        linkWebsite: true,
        customLinks: true,
        visibility: true,
        deactivatedAt: true,
      },
    });

    if (!user || user.deactivatedAt) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    // 友だち関係ステータスを先に判定
    let friendshipStatus: "none" | "pending-sent" | "pending-received" | "friends" = "none";
    let friendshipId: string | null = null;
    let isMe = false;

    const session = await auth();
    if (session?.user?.id) {
      if (session.user.id === userId) {
        isMe = true;
      } else if (await isBlocked(session.user.id, userId)) {
        return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
      } else {
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { requesterId: session.user.id, addresseeId: userId },
              { requesterId: userId, addresseeId: session.user.id },
            ],
          },
        });

        if (friendship) {
          friendshipId = friendship.id;
          if (friendship.status === "ACCEPTED") {
            friendshipStatus = "friends";
          } else if (friendship.status === "PENDING") {
            friendshipStatus = friendship.requesterId === session.user.id
              ? "pending-sent"
              : "pending-received";
          }
        }
      }
    }

    const isFriend = friendshipStatus === "friends";
    const vis = parseVisibility(user.visibility);

    // 項目ごとに公開判定: 本人 or public or (friends かつ友だち)
    const canSee = (field: "bio" | "area" | "links" | "readings") =>
      isMe || vis[field] === "public" || (vis[field] === "friends" && isFriend);

    // 並列で統計・読書状況・カスタムリンクを取得
    const [readingCount, completedCount, friendCount, readings] = await Promise.all([
      canSee("readings")
        ? prisma.readingStatus.count({ where: { userId, status: "READING" } })
        : Promise.resolve(0),
      canSee("readings")
        ? prisma.readingStatus.count({ where: { userId, status: "COMPLETED" } })
        : Promise.resolve(0),
      prisma.friendship.count({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
      canSee("readings")
        ? prisma.readingStatus.findMany({
            where: { userId },
            include: {
              book: {
                select: { id: true, title: true, author: true, coverImageUrl: true, totalPages: true },
              },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    let customLinks: unknown[] = [];
    if (canSee("links") && user.customLinks) {
      try { customLinks = JSON.parse(user.customLinks); } catch { /* */ }
    }

    const displayName = await (await import("@/lib/user-display")).getDisplayName(user.id);
    const userResponse = {
      id: user.id,
      name: user.name,
      displayName: displayName ?? user.name,
      image: user.image,
      bio: canSee("bio") ? user.bio : null,
      area: canSee("area") ? user.area : null,
      linkX: canSee("links") ? user.linkX : null,
      linkInstagram: canSee("links") ? user.linkInstagram : null,
      linkWebsite: canSee("links") ? user.linkWebsite : null,
      customLinks: canSee("links") ? customLinks : [],
      visibility: vis,
    };

    // どの項目が非表示かをフロントに伝える
    const hiddenFields = {
      bio: !canSee("bio") && !!user.bio,
      area: !canSee("area") && !!user.area,
      links: !canSee("links"),
      readings: !canSee("readings"),
    };

    return NextResponse.json({
      user: userResponse,
      readings,
      friendshipStatus,
      friendshipId,
      hiddenFields,
      stats: { readingCount, completedCount, friendCount },
    });
  } catch (e) {
    console.error("User profile GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
