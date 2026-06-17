import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminAuditLog } from "@/lib/admin-audit";
import { prisma } from "@/lib/db";

const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 2000;
const ALLOWED_LEVELS = new Set(["important", "urgent", "maintenance"]);
const ALLOWED_STATUSES = new Set(["draft", "published", "archived"]);

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
  const status = normalizeText((body as { status?: unknown } | null)?.status) || "draft";
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
  if (!ALLOWED_STATUSES.has(status)) return { error: "status が不正です" };
  if (expiresAt === "invalid") return { error: "expiresAt が不正です" };

  return {
    data: {
      title,
      body: announcementBody,
      level,
      status,
      expiresAt,
    },
  };
}

function actionForStatusChange(previousStatus: string, newStatus: string) {
  if (previousStatus !== "published" && newStatus === "published") {
    return "announcement.publish";
  }
  if (previousStatus !== "archived" && newStatus === "archived") {
    return "announcement.archive";
  }
  return "announcement.update";
}

async function getAnnouncement(announcementId: string) {
  return prisma.importantAnnouncement.findUnique({
    where: { id: announcementId },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      level: true,
      publishedAt: true,
      expiresAt: true,
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
  { params }: { params: Promise<{ announcementId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { announcementId } = await params;
  const announcement = await getAnnouncement(announcementId);
  if (!announcement) {
    return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ announcement });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { announcementId } = await params;
  const body = await request.json().catch(() => null);
  const validated = validateAnnouncementInput(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const current = await prisma.importantAnnouncement.findUnique({
    where: { id: announcementId },
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

  const updated = await prisma.importantAnnouncement.update({
    where: { id: announcementId },
    data: {
      ...validated.data,
      publishedAt,
      updatedById: admin.userId,
    },
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      level: true,
      publishedAt: true,
      expiresAt: true,
      updatedAt: true,
    },
  });

  await createAdminAuditLog({
    adminUserId: admin.userId,
    action: actionForStatusChange(current.status, updated.status),
    targetType: "ImportantAnnouncement",
    targetId: updated.id,
    metadata: {
      previousStatus: current.status,
      newStatus: updated.status,
      level: updated.level,
      expiresAt: updated.expiresAt?.toISOString() ?? null,
    },
    request,
  });

  return NextResponse.json({ announcement: updated });
}
