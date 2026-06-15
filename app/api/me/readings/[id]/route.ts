import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const reading = await prisma.readingStatus.findUnique({ where: { id } });
    if (!reading || reading.userId !== session.user.id) {
      return NextResponse.json({ error: "読書ステータスが見つかりません" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.completedAt !== undefined) {
      if (reading.status !== "COMPLETED" || !reading.bookId) {
        return NextResponse.json({ error: "読了済みの本の読了日だけ更新できます" }, { status: 400 });
      }

      if (typeof body.completedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.completedAt)) {
        return NextResponse.json({ error: "completedAt は YYYY-MM-DD で指定してください" }, { status: 400 });
      }

      const [year, month, day] = body.completedAt.split("-").map(Number);
      const completedAt = new Date(year, month - 1, day);
      if (
        completedAt.getFullYear() !== year ||
        completedAt.getMonth() !== month - 1 ||
        completedAt.getDate() !== day
      ) {
        return NextResponse.json({ error: "completedAt が正しい日付ではありません" }, { status: 400 });
      }

      updateData.completedAt = completedAt;
    }

    if (body.currentPage !== undefined) {
      updateData.currentPage = body.currentPage;
    }

    if (body.status) {
      const newStatus = body.status.toUpperCase();
      updateData.status = newStatus;
      if (newStatus === "COMPLETED") {
        updateData.completedAt = new Date();
      } else if (newStatus === "READING") {
        updateData.completedAt = null;
        if (!reading.startedAt) {
          updateData.startedAt = new Date();
        }
      }
    }

    const updated = await prisma.readingStatus.update({
      where: { id },
      data: updateData,
      include: { book: true },
    });

    return NextResponse.json({ reading: updated });
  } catch (e) {
    console.error("Reading PATCH error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { id } = await params;

    const reading = await prisma.readingStatus.findUnique({ where: { id } });
    if (!reading || reading.userId !== session.user.id) {
      return NextResponse.json({ error: "読書ステータスが見つかりません" }, { status: 404 });
    }

    await prisma.readingStatus.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Reading DELETE error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
