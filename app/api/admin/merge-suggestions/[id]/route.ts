import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { createAdminAuditLog } from "@/lib/admin-audit";

// PATCH /api/admin/merge-suggestions/:id
// 承認（approve → merge 実行）または却下（reject）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // "approve" or "reject"

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "action は approve または reject です" },
        { status: 400 }
      );
    }

    const suggestion = await prisma.mergeSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      return NextResponse.json({ error: "報告が見つかりません" }, { status: 404 });
    }

    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { error: "この報告は既に処理済みです" },
        { status: 400 }
      );
    }

    if (action === "reject") {
      await prisma.mergeSuggestion.update({
        where: { id },
        data: { status: "rejected" },
      });
      await createAdminAuditLog({
        adminUserId: admin.userId,
        action: "mergeSuggestion.reject",
        targetType: "MergeSuggestion",
        targetId: id,
        metadata: {
          sourceWorkId: suggestion.sourceWorkId,
          targetWorkId: suggestion.targetWorkId,
        },
        request,
      });
      return NextResponse.json({ success: true, status: "rejected" });
    }

    // approve: merge 実行
    // source → target に統合
    const { sourceWorkId, targetWorkId } = suggestion;

    // target が存在するか確認
    const targetWork = await prisma.work.findUnique({ where: { id: targetWorkId } });
    if (!targetWork) {
      return NextResponse.json({ error: "統合先の作品が削除されています" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Edition 移動
      await tx.edition.updateMany({
        where: { workId: sourceWorkId },
        data: { workId: targetWorkId },
      });

      // TranslationGroup 移動
      await tx.translationGroup.updateMany({
        where: { workId: sourceWorkId },
        data: { workId: targetWorkId },
      });

      // ReadingStatus 更新
      await tx.readingStatus.updateMany({
        where: { workId: sourceWorkId },
        data: { workId: targetWorkId },
      });

      // Review: 重複ユーザーは先勝ち
      const existingReviewers = await tx.review.findMany({
        where: { workId: targetWorkId },
        select: { userId: true },
      });
      const existingIds = new Set(existingReviewers.map((r) => r.userId));
      if (existingIds.size > 0) {
        await tx.review.deleteMany({
          where: { workId: sourceWorkId, userId: { in: [...existingIds] } },
        });
      }
      await tx.review.updateMany({
        where: { workId: sourceWorkId },
        data: { workId: targetWorkId },
      });

      // ChatMessage 更新
      await tx.chatMessage.updateMany({
        where: { workId: sourceWorkId },
        data: { workId: targetWorkId },
      });

      // ReadingEvent 更新
      await tx.readingEvent.updateMany({
        where: { workId: sourceWorkId },
        data: { workId: targetWorkId },
      });

      // MergeSuggestion ステータス更新
      await tx.mergeSuggestion.update({
        where: { id },
        data: { status: "approved" },
      });

      // 同じペアの他の pending をまとめて approved に
      await tx.mergeSuggestion.updateMany({
        where: {
          OR: [
            { sourceWorkId, targetWorkId },
            { sourceWorkId: targetWorkId, targetWorkId: sourceWorkId },
          ],
          status: "pending",
        },
        data: { status: "approved" },
      });

      // source Work 削除
      await tx.work.delete({ where: { id: sourceWorkId } });
    });

    await createAdminAuditLog({
      adminUserId: admin.userId,
      action: "mergeSuggestion.approve",
      targetType: "MergeSuggestion",
      targetId: id,
      metadata: {
        sourceWorkId,
        targetWorkId,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      status: "approved",
      merged_into: targetWorkId,
    });
  } catch (e) {
    console.error("MergeSuggestion PATCH error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
