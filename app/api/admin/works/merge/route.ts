import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

// POST /api/admin/works/merge
// 複数の Work を 1 つの target_work_id に統合
// body: { source_work_ids: string[], target_work_id: string }
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const body = await request.json();
    const { source_work_ids, target_work_id } = body;

    if (!Array.isArray(source_work_ids) || source_work_ids.length === 0 || !target_work_id) {
      return NextResponse.json(
        { error: "source_work_ids (配列) と target_work_id は必須です" },
        { status: 400 }
      );
    }

    if (source_work_ids.includes(target_work_id)) {
      return NextResponse.json(
        { error: "target_work_id は source_work_ids に含められません" },
        { status: 400 }
      );
    }

    // target Work の存在確認
    const targetWork = await prisma.work.findUnique({ where: { id: target_work_id } });
    if (!targetWork) {
      return NextResponse.json({ error: "統合先の作品が見つかりません" }, { status: 404 });
    }

    // source Works の存在確認
    const sourceWorks = await prisma.work.findMany({
      where: { id: { in: source_work_ids } },
      select: { id: true },
    });
    if (sourceWorks.length !== source_work_ids.length) {
      return NextResponse.json({ error: "一部の統合元作品が見つかりません" }, { status: 404 });
    }

    // トランザクションで統合実行
    const result = await prisma.$transaction(async (tx) => {
      // 1. Edition を target Work に移動
      const editionResult = await tx.edition.updateMany({
        where: { workId: { in: source_work_ids } },
        data: { workId: target_work_id },
      });

      // 2. TranslationGroup を target Work に移動
      await tx.translationGroup.updateMany({
        where: { workId: { in: source_work_ids } },
        data: { workId: target_work_id },
      });

      // 3. ReadingStatus の workId を更新
      const readingResult = await tx.readingStatus.updateMany({
        where: { workId: { in: source_work_ids } },
        data: { workId: target_work_id },
      });

      // 4. Review の workId を更新（重複ユーザーは先勝ち、後のを削除）
      // まず target に既にレビューがあるユーザーを取得
      const existingReviewers = await tx.review.findMany({
        where: { workId: target_work_id },
        select: { userId: true },
      });
      const existingReviewerIds = new Set(existingReviewers.map((r) => r.userId));

      // source のレビューのうち、既にレビュー済みのユーザーのものは削除
      if (existingReviewerIds.size > 0) {
        await tx.review.deleteMany({
          where: {
            workId: { in: source_work_ids },
            userId: { in: [...existingReviewerIds] },
          },
        });
      }
      // 残りのレビューを target に移動
      const reviewResult = await tx.review.updateMany({
        where: { workId: { in: source_work_ids } },
        data: { workId: target_work_id },
      });

      // 5. ChatMessage の workId を更新
      await tx.chatMessage.updateMany({
        where: { workId: { in: source_work_ids } },
        data: { workId: target_work_id },
      });

      // 6. ReadingEvent の workId を更新
      await tx.readingEvent.updateMany({
        where: { workId: { in: source_work_ids } },
        data: { workId: target_work_id },
      });

      // 7. MergeSuggestion のステータスを approved に更新
      await tx.mergeSuggestion.updateMany({
        where: {
          OR: [
            { sourceWorkId: { in: source_work_ids }, targetWorkId: target_work_id },
            { sourceWorkId: target_work_id, targetWorkId: { in: source_work_ids } },
          ],
          status: "pending",
        },
        data: { status: "approved" },
      });

      // 8. 空になった source Work を削除
      await tx.work.deleteMany({
        where: { id: { in: source_work_ids } },
      });

      return {
        editions_moved: editionResult.count,
        readings_updated: readingResult.count,
        reviews_moved: reviewResult.count,
        works_deleted: source_work_ids.length,
      };
    });

    return NextResponse.json({
      success: true,
      target_work_id,
      ...result,
    });
  } catch (e) {
    console.error("Works merge error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
