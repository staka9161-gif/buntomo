import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const OPEN_STATUSES = ["pending", "reviewing"];
const MIN_MESSAGE_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 2000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;
const MAX_APPEALS_PER_30_DAYS = 3;

async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      accountStatus: true,
      deactivatedAt: true,
    },
  });
}

function serializeAppeal(
  appeal: {
    id: string;
    status: string;
    message: string;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
  } | null
) {
  if (!appeal) return null;
  return {
    id: appeal.id,
    status: appeal.status,
    message: appeal.message,
    createdAt: appeal.createdAt.toISOString(),
    updatedAt: appeal.updatedAt.toISOString(),
    resolvedAt: appeal.resolvedAt?.toISOString() ?? null,
  };
}

function nextAllowedFromLatest(latestCreatedAt: Date | null) {
  if (!latestCreatedAt) return null;
  const next = new Date(latestCreatedAt.getTime() + ONE_DAY_MS);
  return next > new Date() ? next : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.deactivatedAt) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const latestAppeal = await prisma.suspensionAppeal.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
    },
  });

  return NextResponse.json({
    suspended: user.accountStatus === "suspended",
    latestAppeal: serializeAppeal(latestAppeal),
    hasOpenAppeal: latestAppeal ? OPEN_STATUSES.includes(latestAppeal.status) : false,
    nextAllowedAt: nextAllowedFromLatest(latestAppeal?.createdAt ?? null)?.toISOString() ?? null,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.deactivatedAt) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (user.accountStatus !== "suspended") {
    return NextResponse.json(
      { error: "利用停止中のアカウントのみ異議申し立てを送信できます" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (message.length < MIN_MESSAGE_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `${MIN_MESSAGE_LENGTH}文字以上${MAX_MESSAGE_LENGTH}文字以内で入力してください` },
      { status: 400 }
    );
  }

  const latestAppeal = await prisma.suspensionAppeal.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  if (latestAppeal && OPEN_STATUSES.includes(latestAppeal.status)) {
    return NextResponse.json(
      { error: "未対応または確認中の異議申し立てがあります" },
      { status: 409 }
    );
  }

  const nextAllowedAt = nextAllowedFromLatest(latestAppeal?.createdAt ?? null);
  if (nextAllowedAt) {
    return NextResponse.json(
      {
        error: "短時間に複数回送信することはできません",
        nextAllowedAt: nextAllowedAt.toISOString(),
      },
      { status: 429 }
    );
  }

  const recentAppeals = await prisma.suspensionAppeal.count({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) },
    },
  });

  if (recentAppeals >= MAX_APPEALS_PER_30_DAYS) {
    return NextResponse.json(
      { error: "30日以内に送信できる回数を超えています" },
      { status: 429 }
    );
  }

  const appeal = await prisma.suspensionAppeal.create({
    data: {
      userId: user.id,
      message,
      status: "pending",
    },
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
    },
  });

  return NextResponse.json({ appeal: serializeAppeal(appeal) }, { status: 201 });
}
