import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { announcementId } = await params;
  const now = new Date();

  const announcement = await prisma.importantAnnouncement.findFirst({
    where: {
      id: announcementId,
      status: "published",
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });

  if (!announcement) {
    return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });
  }

  await prisma.importantAnnouncementRead.upsert({
    where: {
      announcementId_userId: {
        announcementId,
        userId: session.user.id,
      },
    },
    create: {
      announcementId,
      userId: session.user.id,
    },
    update: {
      readAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
