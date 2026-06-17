import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { createAdminAuditLog } from "@/lib/admin-audit";

const ALLOWED_STATUSES = new Set(["pending", "reviewing", "resolved", "rejected"]);
const CLOSED_STATUSES = new Set(["resolved", "rejected"]);
const MAX_ADMIN_NOTE_LENGTH = 2000;

function normalizeAdminNote(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getAppeal(appealId: string) {
  return prisma.suspensionAppeal.findUnique({
    where: { id: appealId },
    select: {
      id: true,
      status: true,
      message: true,
      adminNote: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          handle: true,
          accountStatus: true,
          deactivatedAt: true,
        },
      },
      adminUser: {
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
  { params }: { params: Promise<{ appealId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { appealId } = await params;
  const appeal = await getAppeal(appealId);

  if (!appeal) {
    return NextResponse.json({ error: "異議申し立てが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ appeal });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ appealId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { appealId } = await params;
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const adminNote = normalizeAdminNote(body?.adminNote);

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "status が不正です" }, { status: 400 });
  }

  if (adminNote.length > MAX_ADMIN_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `管理メモは${MAX_ADMIN_NOTE_LENGTH}文字以内で入力してください` },
      { status: 400 }
    );
  }

  if (CLOSED_STATUSES.has(status) && !adminNote) {
    return NextResponse.json(
      { error: "確認済みまたは却下にする場合は管理メモを入力してください" },
      { status: 400 }
    );
  }

  const appeal = await prisma.suspensionAppeal.findUnique({
    where: { id: appealId },
    select: {
      id: true,
      userId: true,
      status: true,
    },
  });

  if (!appeal) {
    return NextResponse.json({ error: "異議申し立てが見つかりません" }, { status: 404 });
  }

  const updated = await prisma.suspensionAppeal.update({
    where: { id: appealId },
    data: {
      status,
      adminNote: adminNote || null,
      adminUserId: admin.userId,
      resolvedAt: CLOSED_STATUSES.has(status) ? new Date() : null,
    },
    select: {
      id: true,
      status: true,
      adminNote: true,
      adminUserId: true,
      resolvedAt: true,
      updatedAt: true,
    },
  });

  await createAdminAuditLog({
    adminUserId: admin.userId,
    action: "suspensionAppeal.updateStatus",
    targetType: "SuspensionAppeal",
    targetId: appealId,
    targetUserId: appeal.userId,
    reason: adminNote || `${appeal.status} -> ${status}`,
    metadata: {
      previousStatus: appeal.status,
      newStatus: status,
    },
    request,
  });

  return NextResponse.json({ appeal: updated });
}
