import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/db";
import {
  actionForUpdateNoticeStatusChange,
  truncateAuditTitle,
  validateUpdateNoticeInput,
} from "@/lib/update-notices";

async function getNotice(noticeId: string) {
  return prisma.updateNotice.findUnique({
    where: { id: noticeId },
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      topicTag: true,
      href: true,
      status: true,
      publishedAt: true,
      displayDate: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
      updatedBy: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { noticeId } = await params;
  const notice = await getNotice(noticeId);
  if (!notice) {
    return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ notice });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { noticeId } = await params;
  const body = await request.json().catch(() => null);
  const validated = validateUpdateNoticeInput(body, { allowStatus: true });
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const current = await prisma.updateNotice.findUnique({
    where: { id: noticeId },
    select: {
      id: true,
      status: true,
      publishedAt: true,
    },
  });

  if (!current) {
    return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });
  }

  const publishedAt =
    validated.data.status === "published"
      ? current.publishedAt ?? new Date()
      : current.publishedAt;

  const updated = await prisma.updateNotice.update({
    where: { id: noticeId },
    data: {
      ...validated.data,
      publishedAt,
      updatedById: admin.userId,
    },
    select: {
      id: true,
      title: true,
      type: true,
      topicTag: true,
      href: true,
      status: true,
      publishedAt: true,
      displayDate: true,
      updatedAt: true,
    },
  });

  await createAdminAuditLog({
    adminUserId: admin.userId,
    action: actionForUpdateNoticeStatusChange(current.status, updated.status),
    targetType: "UpdateNotice",
    targetId: updated.id,
    metadata: {
      previousStatus: current.status,
      newStatus: updated.status,
      type: updated.type,
      topicTag: updated.topicTag,
      href: updated.href,
      displayDate: updated.displayDate.toISOString(),
      title: truncateAuditTitle(updated.title),
    },
    request,
  });

  return NextResponse.json({ notice: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noticeId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { noticeId } = await params;
  const current = await prisma.updateNotice.findUnique({
    where: { id: noticeId },
    select: {
      id: true,
      title: true,
      type: true,
      topicTag: true,
      href: true,
      status: true,
      displayDate: true,
    },
  });

  if (!current) {
    return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });
  }

  await prisma.updateNotice.delete({ where: { id: noticeId } });

  await createAdminAuditLog({
    adminUserId: admin.userId,
    action: "updateNotice.delete",
    targetType: "UpdateNotice",
    targetId: current.id,
    metadata: {
      previousStatus: current.status,
      type: current.type,
      topicTag: current.topicTag,
      href: current.href,
      displayDate: current.displayDate.toISOString(),
      title: truncateAuditTitle(current.title),
    },
    request,
  });

  return NextResponse.json({ ok: true });
}
