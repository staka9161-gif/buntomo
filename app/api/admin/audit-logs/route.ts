import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  const action = searchParams.get("action")?.trim();
  const targetType = searchParams.get("targetType")?.trim();
  const adminUserId = searchParams.get("adminUserId")?.trim();
  const targetUserId = searchParams.get("targetUserId")?.trim();

  const where: Prisma.AdminAuditLogWhereInput = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (adminUserId) where.adminUserId = adminUserId;
  if (targetUserId) where.targetUserId = targetUserId;

  const [total, logs] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        targetUserId: true,
        reason: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
