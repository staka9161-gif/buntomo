import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isBlocked } from "@/lib/block";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const [received, sent] = await Promise.all([
    prisma.friendship.findMany({
      where: { addresseeId: session.user.id, status: "PENDING" },
      include: {
        requester: { select: { id: true, displayName: true, avatarUrl: true, bio: true, area: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendship.findMany({
      where: { requesterId: session.user.id, status: "PENDING" },
      include: {
        addressee: { select: { id: true, displayName: true, avatarUrl: true, bio: true, area: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    received: received.map((r) => ({
      id: r.id,
      user: r.requester,
      createdAt: r.createdAt,
    })),
    sent: sent.map((s) => ({
      id: s.id,
      user: s.addressee,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "ユーザーIDは必須です" }, { status: 400 });
  }

  if (userId === session.user.id) {
    return NextResponse.json({ error: "自分自身には申請できません" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  if (await isBlocked(session.user.id, userId)) {
    return NextResponse.json({ error: "このユーザーには申請できません" }, { status: 403 });
  }

  // 既存の関係をチェック（両方向）
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: session.user.id, addresseeId: userId },
        { requesterId: userId, addresseeId: session.user.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === "ACCEPTED") {
      return NextResponse.json({ error: "既に友だちです" }, { status: 409 });
    }
    if (existing.status === "PENDING") {
      return NextResponse.json({ error: "既に申請済みです" }, { status: 409 });
    }
    if (existing.status === "REJECTED") {
      return NextResponse.json({ error: "現在申請できません" }, { status: 409 });
    }
  }

  const friendship = await prisma.friendship.create({
    data: {
      requesterId: session.user.id,
      addresseeId: userId,
    },
  });

  return NextResponse.json({ friendship }, { status: 201 });
}
