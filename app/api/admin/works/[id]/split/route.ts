import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

// POST /api/admin/works/:id/split
// Work から一部の Edition を切り出して新しい Work を作成
// body: { edition_ids_to_move: string[], new_work: { title, author, description? } }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const { id: sourceWorkId } = await params;
    const body = await request.json();
    const { edition_ids_to_move, new_work } = body;

    if (!Array.isArray(edition_ids_to_move) || edition_ids_to_move.length === 0) {
      return NextResponse.json(
        { error: "edition_ids_to_move (配列) は必須です" },
        { status: 400 }
      );
    }

    if (!new_work?.title || !new_work?.author) {
      return NextResponse.json(
        { error: "new_work.title と new_work.author は必須です" },
        { status: 400 }
      );
    }

    // 元 Work の存在確認
    const sourceWork = await prisma.work.findUnique({
      where: { id: sourceWorkId },
      include: { editions: { select: { id: true } } },
    });

    if (!sourceWork) {
      return NextResponse.json({ error: "作品が見つかりません" }, { status: 404 });
    }

    // 移動対象の Edition が全て source Work に属しているか確認
    const sourceEditionIds = new Set(sourceWork.editions.map((e) => e.id));
    for (const eid of edition_ids_to_move) {
      if (!sourceEditionIds.has(eid)) {
        return NextResponse.json(
          { error: `Edition ${eid} はこの作品に属していません` },
          { status: 400 }
        );
      }
    }

    // 全 Edition を移動してしまうのは禁止（元 Work が空になる）
    if (edition_ids_to_move.length >= sourceWork.editions.length) {
      return NextResponse.json(
        { error: "全ての版を移動することはできません。統合機能を使用してください" },
        { status: 400 }
      );
    }

    // トランザクションで分割実行
    const result = await prisma.$transaction(async (tx) => {
      // 1. 新しい Work を作成
      const newWork = await tx.work.create({
        data: {
          title: new_work.title,
          titleNormalized: new_work.title_normalized || "",
          author: new_work.author,
          authorNormalized: new_work.author_normalized || "",
          description: new_work.description || null,
          originalTitle: new_work.original_title || null,
        },
      });

      // 2. Edition を新 Work に移動
      await tx.edition.updateMany({
        where: { id: { in: edition_ids_to_move } },
        data: { workId: newWork.id },
      });

      // 3. 移動した Edition に紐づく ReadingStatus の workId を更新
      await tx.readingStatus.updateMany({
        where: { editionId: { in: edition_ids_to_move } },
        data: { workId: newWork.id },
      });

      // 4. 移動した Edition に紐づく Review の workId を更新
      await tx.review.updateMany({
        where: { editionId: { in: edition_ids_to_move } },
        data: { workId: newWork.id },
      });

      return { new_work_id: newWork.id, editions_moved: edition_ids_to_move.length };
    });

    return NextResponse.json({
      success: true,
      source_work_id: sourceWorkId,
      ...result,
    });
  } catch (e) {
    console.error("Works split error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
