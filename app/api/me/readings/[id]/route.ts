import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

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

    if (body.currentPage !== undefined) {
      updateData.currentPage = body.currentPage;
    }

    if (body.completedAt !== undefined) {
      if (reading.status !== "COMPLETED") {
        return NextResponse.json({ error: "読了済みの本のみ読了日を変更できます" }, { status: 400 });
      }

      const completedAt = parseDateOnly(body.completedAt);
      if (!completedAt) {
        return NextResponse.json({ error: "読了日は YYYY-MM-DD 形式で指定してください" }, { status: 400 });
      }

      updateData.completedAt = completedAt;
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
