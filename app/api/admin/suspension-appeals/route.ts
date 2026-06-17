import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const ALLOWED_STATUSES = new Set(["pending", "reviewing", "resolved", "rejected"]);

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
  const status = searchParams.get("status")?.trim() ?? "";

  const where: Prisma.SuspensionAppealWhereInput = {};
  if (status && ALLOWED_STATUSES.has(status)) {
    where.status = status;
  }

  const [total, appeals] = await Promise.all([
    prisma.suspensionAppeal.count({ where }),
    prisma.suspensionAppeal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
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
    }),
  ]);

  return NextResponse.json({
    appeals,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
