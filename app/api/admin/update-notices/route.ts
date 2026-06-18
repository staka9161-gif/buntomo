import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/db";
import {
  truncateAuditTitle,
  updateNoticeStatuses,
  validateUpdateNoticeInput,
} from "@/lib/update-notices";

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
    MAX_PAGE_SIZE,
  );
  const status = searchParams.get("status")?.trim();

  const where: Prisma.UpdateNoticeWhereInput = {};
  if (status && updateNoticeStatuses.includes(status as (typeof updateNoticeStatuses)[number])) {
    where.status = status;
  }

  const [total, notices] = await Promise.all([
    prisma.updateNotice.count({ where }),
    prisma.updateNotice.findMany({
      where,
      orderBy: [{ displayDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        type: true,
        topicTag: true,
        href: true,
        status: true,
        publishedAt: true,
        displayDate: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    notices,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = await request.json().catch(() => null);
  const validated = validateUpdateNoticeInput(body, { allowStatus: false });
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const notice = await prisma.updateNotice.create({
    data: {
      ...validated.data,
      status: "draft",
      createdById: admin.userId,
      updatedById: admin.userId,
    },
    select: {
      id: true,
      title: true,
      type: true,
      topicTag: true,
      href: true,
      status: true,
      displayDate: true,
      createdAt: true,
    },
  });

  await createAdminAuditLog({
    adminUserId: admin.userId,
    action: "updateNotice.create",
    targetType: "UpdateNotice",
    targetId: notice.id,
    metadata: {
      newStatus: notice.status,
      type: notice.type,
      topicTag: notice.topicTag,
      href: notice.href,
      displayDate: notice.displayDate.toISOString(),
      title: truncateAuditTitle(notice.title),
    },
    request,
  });

  return NextResponse.json({ notice }, { status: 201 });
}
