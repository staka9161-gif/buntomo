import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
}
