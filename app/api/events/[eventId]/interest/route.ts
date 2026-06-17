import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireActiveUser } from "@/lib/active-user";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await auth();
    const viewerId = session?.user?.id ?? null;

    const event = await prisma.readingEvent.findFirst({
      where: {
        id: eventId,
        organizer: { deactivatedAt: null },
      },
      select: { id: true, organizerId: true },
    });

    if (!event) {
      return NextResponse.json({ error: "読書会が見つかりません" }, { status: 404 });
    }

    const [count, myInterest] = await Promise.all([
      prisma.readingEventInterest.count({
        where: {
          eventId,
          user: { deactivatedAt: null },
        },
      }),
      viewerId
        ? prisma.readingEventInterest.findUnique({
            where: { eventId_userId: { eventId, userId: viewerId } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    const canViewInterestedUsers = viewerId === event.organizerId;

    if (!canViewInterestedUsers) {
      return NextResponse.json({
        count,
        isInterested: !!myInterest,
        canViewInterestedUsers: false,
      });
    }

    const interests = await prisma.readingEventInterest.findMany({
      where: {
        eventId,
        user: { deactivatedAt: null },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            handle: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      count,
      isInterested: !!myInterest,
      canViewInterestedUsers: true,
      interestedUsers: interests.map((interest) => ({
        id: interest.user.id,
        name: interest.user.name,
        handle: interest.user.handle,
        image: interest.user.image,
      })),
    });
  } catch (error) {
    console.error("Reading event interest GET error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const { eventId } = await params;
    const event = await prisma.readingEvent.findFirst({
      where: {
        id: eventId,
        organizer: { deactivatedAt: null },
      },
      select: { id: true, organizerId: true },
    });

    if (!event) {
      return NextResponse.json({ error: "読書会が見つかりません" }, { status: 404 });
    }

    if (event.organizerId === activeUser.userId) {
      return NextResponse.json({ error: "自分が主催する読書会には気になるできません" }, { status: 400 });
    }

    try {
      await prisma.readingEventInterest.create({
        data: {
          eventId,
          userId: activeUser.userId,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
        throw error;
      }
    }

    const count = await prisma.readingEventInterest.count({
      where: {
        eventId,
        user: { deactivatedAt: null },
      },
    });

    return NextResponse.json({ success: true, count, isInterested: true });
  } catch (error) {
    console.error("Reading event interest POST error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const { eventId } = await params;
    const event = await prisma.readingEvent.findFirst({
      where: {
        id: eventId,
        organizer: { deactivatedAt: null },
      },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json({ error: "読書会が見つかりません" }, { status: 404 });
    }

    await prisma.readingEventInterest.deleteMany({
      where: {
        eventId,
        userId: activeUser.userId,
      },
    });

    const count = await prisma.readingEventInterest.count({
      where: {
        eventId,
        user: { deactivatedAt: null },
      },
    });

    return NextResponse.json({ success: true, count, isInterested: false });
  } catch (error) {
    console.error("Reading event interest DELETE error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
