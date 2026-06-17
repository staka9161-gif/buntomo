import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveUser } from "@/lib/active-user";

const ALLOWED_REASONS = new Set([
  "inappropriate_profile",
  "inappropriate_content",
  "harassment",
  "impersonation",
  "spam_or_scam",
  "other",
]);

const ALLOWED_TARGET_TYPES = new Set(["USER", "BOOK_CHAT_MESSAGE", "REVIEW", "READING_EVENT"]);

export async function POST(request: NextRequest) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const body = await request.json().catch(() => null);
    const targetType = typeof body?.targetType === "string" ? body.targetType : "";
    const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason : "";
    const detail = typeof body?.detail === "string" ? body.detail.trim() : "";

    if (!ALLOWED_TARGET_TYPES.has(targetType)) {
      return NextResponse.json({ error: "通報対象が正しくありません" }, { status: 400 });
    }

    if (!targetId) {
      return NextResponse.json({ error: "通報対象が正しくありません" }, { status: 400 });
    }

    if (!ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ error: "通報理由を選択してください" }, { status: 400 });
    }

    if (detail.length > 1000) {
      return NextResponse.json({ error: "詳細は1000文字以内で入力してください" }, { status: 400 });
    }

    let targetUserId: string;

    if (targetType === "USER") {
      if (targetId === activeUser.userId) {
        return NextResponse.json({ error: "自分自身は通報できません" }, { status: 400 });
      }

      const targetUser = await prisma.user.findFirst({
        where: { id: targetId, deactivatedAt: null },
        select: { id: true },
      });

      if (!targetUser) {
        return NextResponse.json({ error: "通報対象が見つかりません" }, { status: 404 });
      }

      targetUserId = targetUser.id;
    } else if (targetType === "BOOK_CHAT_MESSAGE") {
      const chatMessage = await prisma.chatMessage.findFirst({
        where: {
          id: targetId,
          user: { deactivatedAt: null },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!chatMessage) {
        return NextResponse.json({ error: "通報対象が見つかりません" }, { status: 404 });
      }

      if (chatMessage.userId === activeUser.userId) {
        return NextResponse.json({ error: "自分の投稿は通報できません" }, { status: 400 });
      }

      targetUserId = chatMessage.userId;
    } else if (targetType === "REVIEW") {
      const review = await prisma.review.findFirst({
        where: {
          id: targetId,
          user: { deactivatedAt: null },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!review) {
        return NextResponse.json({ error: "騾壼ｱ蟇ｾ雎｡縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ" }, { status: 404 });
      }

      if (review.userId === activeUser.userId) {
        return NextResponse.json({ error: "閾ｪ蛻・・謚慕ｨｿ縺ｯ騾壼ｱ縺ｧ縺阪∪縺帙ｓ" }, { status: 400 });
      }

      targetUserId = review.userId;
    } else {
      const readingEvent = await prisma.readingEvent.findFirst({
        where: {
          id: targetId,
          organizer: { deactivatedAt: null },
        },
        select: {
          id: true,
          organizerId: true,
        },
      });

      if (!readingEvent) {
        return NextResponse.json({ error: "騾壼ｱ蟇ｾ雎｡縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ" }, { status: 404 });
      }

      if (readingEvent.organizerId === activeUser.userId) {
        return NextResponse.json({ error: "閾ｪ蛻・・謚慕ｨｿ縺ｯ騾壼ｱ縺ｧ縺阪∪縺帙ｓ" }, { status: 400 });
      }

      targetUserId = readingEvent.organizerId;
    }

    const existing = await prisma.report.findFirst({
      where: {
        reporterId: activeUser.userId,
        targetType,
        targetId,
        status: { in: ["pending", "reviewing"] },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "すでに通報済みです" }, { status: 409 });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: activeUser.userId,
        targetType,
        targetId,
        targetUserId,
        reason,
        detail: detail || null,
        status: "pending",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Report POST error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
