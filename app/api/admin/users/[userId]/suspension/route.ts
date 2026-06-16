import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { getAdminUserDetail } from "@/lib/admin-users";
import { prisma } from "@/lib/db";

type SuspensionAction = "suspend" | "unsuspend";

function normalizeReason(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { userId } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action as SuspensionAction | undefined;
  const reason = normalizeReason(body?.reason);

  if (action !== "suspend" && action !== "unsuspend") {
    return NextResponse.json({ error: "action が不正です" }, { status: 400 });
  }

  if (!reason) {
    return NextResponse.json({ error: "理由を入力してください" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isAdmin: true,
      deactivatedAt: true,
      accountStatus: true,
    },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "利用者が見つかりません" }, { status: 404 });
  }

  if (targetUser.deactivatedAt) {
    return NextResponse.json({ error: "退会済みユーザーは対象外です" }, { status: 400 });
  }

  if (action === "suspend") {
    if (targetUser.id === admin.userId) {
      return NextResponse.json({ error: "自分自身は停止できません" }, { status: 400 });
    }

    if (targetUser.isAdmin) {
      return NextResponse.json({ error: "管理者ユーザーは停止できません" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: "suspended",
        suspendedAt: new Date(),
        suspendedReason: reason,
        suspendedUntil: null,
      },
    });

    await createAdminAuditLog({
      adminUserId: admin.userId,
      action: "user.suspend",
      targetType: "User",
      targetId: userId,
      targetUserId: userId,
      reason,
      metadata: {
        previousAccountStatus: targetUser.accountStatus,
      },
      request,
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: {
        accountStatus: "active",
        suspendedAt: null,
        suspendedReason: null,
        suspendedUntil: null,
      },
    });

    await createAdminAuditLog({
      adminUserId: admin.userId,
      action: "user.unsuspend",
      targetType: "User",
      targetId: userId,
      targetUserId: userId,
      reason,
      metadata: {
        previousAccountStatus: targetUser.accountStatus,
      },
      request,
    });
  }

  const detail = await getAdminUserDetail(userId);
  return NextResponse.json({ success: true, detail });
}
