import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/works/:id/merge-suggestions
// ユーザーが「これは同じ本です」と報告する
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { id: sourceWorkId } = await params;
    const body = await request.json();
    const { target_work_id, reason } = body;

    if (!target_work_id) {
      return NextResponse.json(
        { error: "target_work_id は必須です" },
        { status: 400 }
      );
    }

    if (sourceWorkId === target_work_id) {
      return NextResponse.json(
        { error: "同じ作品を指定しています" },
        { status: 400 }
      );
    }

    // 両方の Work が存在するか確認
    const [source, target] = await Promise.all([
      prisma.work.findUnique({ where: { id: sourceWorkId }, select: { id: true } }),
      prisma.work.findUnique({ where: { id: target_work_id }, select: { id: true } }),
    ]);

    if (!source || !target) {
      return NextResponse.json({ error: "作品が見つかりません" }, { status: 404 });
    }

    // 既に同じ組み合わせの保留がないかチェック
    const existing = await prisma.mergeSuggestion.findFirst({
      where: {
        OR: [
          { sourceWorkId, targetWorkId: target_work_id },
          { sourceWorkId: target_work_id, targetWorkId: sourceWorkId },
        ],
        status: "pending",
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "この組み合わせは既に報告されています", suggestion_id: existing.id },
        { status: 409 }
      );
    }

    const suggestion = await prisma.mergeSuggestion.create({
      data: {
        sourceWorkId,
        targetWorkId: target_work_id,
        reason: reason || null,
        reporterUserId: session.user.id,
        status: "pending",
      },
    });

    return NextResponse.json({ suggestion }, { status: 201 });
  } catch (e) {
    console.error("MergeSuggestion POST error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
