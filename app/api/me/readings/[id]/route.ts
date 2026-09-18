import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireActiveUser } from "@/lib/active-user";
import { isValidCurrentPage, isValidTotalPages } from "@/lib/reading-pages";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }
    const myId = activeUser.userId;

    const { id } = await params;
    const body = await request.json();

    const reading = await prisma.readingStatus.findUnique({ where: { id } });
    if (!reading || reading.userId !== myId) {
      return NextResponse.json({ error: "読書ステータスが見つかりません" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.totalPages !== undefined) {
      if (!isValidTotalPages(body.totalPages)) {
        return NextResponse.json({ error: "総ページ数は1〜100000の整数で指定してください" }, { status: 400 });
      }
      updateData.totalPages = body.totalPages;
    }

    if (body.currentPage !== undefined && !isValidCurrentPage(body.currentPage)) {
      return NextResponse.json({ error: "現在ページは0〜100000の整数で指定してください" }, { status: 400 });
    }

    // Validate page edits together, without blocking unrelated status/date edits.
    if (body.currentPage !== undefined || body.totalPages !== undefined) {
      const totalPages = body.totalPages ?? reading.totalPages;
      const currentPage = body.currentPage ?? reading.currentPage;
      if (totalPages != null && currentPage > totalPages) {
        return NextResponse.json({ error: "現在ページが総ページ数を超えています" }, { status: 400 });
      }
    }

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
      where: { id, userId: myId },
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

    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }
    const myId = activeUser.userId;

    const { id } = await params;

    const reading = await prisma.readingStatus.findUnique({ where: { id } });
    if (!reading || reading.userId !== myId) {
      return NextResponse.json({ error: "読書ステータスが見つかりません" }, { status: 404 });
    }

    await prisma.readingStatus.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Reading DELETE error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
