import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const now = new Date();

  const announcements = await prisma.importantAnnouncement.findMany({
    where: {
      status: "published",
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 10,
    select: {
      id: true,
      title: true,
      body: true,
      level: true,
      publishedAt: true,
      expiresAt: true,
      reads: {
        where: { userId: userId ?? "" },
        select: { id: true },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    authenticated: Boolean(userId),
    announcements: announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      level: announcement.level,
      publishedAt: announcement.publishedAt,
      expiresAt: announcement.expiresAt,
      isRead: userId ? announcement.reads.length > 0 : false,
    })),
  });
}
