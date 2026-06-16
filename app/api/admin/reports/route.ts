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

function truncatePreview(value: string | null | undefined) {
  if (!value) return null;
  return value.length > 80 ? `${value.slice(0, 80)}...` : value;
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
  const status = searchParams.get("status")?.trim();
  const targetType = searchParams.get("targetType")?.trim();

  const where: Prisma.ReportWhereInput = {};
  if (status) where.status = status;
  if (targetType) where.targetType = targetType;

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        targetUserId: true,
        reason: true,
        detail: true,
        status: true,
        createdAt: true,
        reporter: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
      },
    }),
  ]);

  const chatMessageIds = reports
    .filter((report) => report.targetType === "BOOK_CHAT_MESSAGE")
    .map((report) => report.targetId);
  const chatMessages =
    chatMessageIds.length > 0
      ? await prisma.chatMessage.findMany({
          where: { id: { in: chatMessageIds } },
          select: {
            id: true,
            content: true,
          },
        })
      : [];
  const chatPreviewById = new Map(
    chatMessages.map((message) => [message.id, truncatePreview(message.content)])
  );

  return NextResponse.json({
    reports: reports.map((report) => ({
      ...report,
      targetPreview:
        report.targetType === "BOOK_CHAT_MESSAGE"
          ? chatPreviewById.get(report.targetId) ?? null
          : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
