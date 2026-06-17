import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/db";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 2000;
const ALLOWED_LEVELS = new Set(["important", "urgent", "maintenance"]);

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

function validateAnnouncementInput(body: unknown) {
  const title = normalizeText((body as { title?: unknown } | null)?.title);
  const announcementBody = normalizeText((body as { body?: unknown } | null)?.body);
  const level = normalizeText((body as { level?: unknown } | null)?.level) || "important";
  const expiresAt = parseOptionalDate((body as { expiresAt?: unknown } | null)?.expiresAt);

  if (!title) return { error: "タイトルを入力してください" };
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `タイトルは${MAX_TITLE_LENGTH}文字以内で入力してください` };
  }
  if (!announcementBody) return { error: "本文を入力してください" };
  if (announcementBody.length > MAX_BODY_LENGTH) {
    return { error: `本文は${MAX_BODY_LENGTH}文字以内で入力してください` };
  }
  if (!ALLOWED_LEVELS.has(level)) return { error: "level が不正です" };
  if (expiresAt === "invalid") return { error: "expiresAt が不正です" };

  return {
    data: {
      title,
      body: announcementBody,
      level,
      expiresAt,
    },
  };
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

  const where: Prisma.ImportantAnnouncementWhereInput = {};
  if (status) where.status = status;

  const [total, announcements] = await Promise.all([
    prisma.importantAnnouncement.count({ where }),
    prisma.importantAnnouncement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        status: true,
        level: true,
        publishedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    announcements,
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
  const validated = validateAnnouncementInput(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const announcement = await prisma.importantAnnouncement.create({
    data: {
      ...validated.data,
      status: "draft",
      createdById: admin.userId,
      updatedById: admin.userId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      level: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  await createAdminAuditLog({
    adminUserId: admin.userId,
    action: "announcement.create",
    targetType: "ImportantAnnouncement",
    targetId: announcement.id,
    metadata: {
      newStatus: announcement.status,
      level: announcement.level,
      expiresAt: announcement.expiresAt?.toISOString() ?? null,
    },
    request,
  });

  return NextResponse.json({ announcement }, { status: 201 });
}
