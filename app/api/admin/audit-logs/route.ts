import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const SENSITIVE_METADATA_KEYS = [
  "content",
  "body",
  "message",
  "text",
  "dm",
  "email",
  "token",
  "password",
];

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function isSensitiveMetadataKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_METADATA_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey));
}

function sanitizeMetadata(value: Prisma.JsonValue): Prisma.JsonValue {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeMetadata(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const jsonItem = item === undefined ? null : (item as Prisma.JsonValue);
      return [key, isSensitiveMetadataKey(key) ? "[非表示]" : sanitizeMetadata(jsonItem)];
    })
  );
}

function metadataSummary(value: Prisma.JsonValue | null) {
  if (!value) return null;

  try {
    const sanitized = sanitizeMetadata(value);
    const text = JSON.stringify(sanitized);
    return text.length > 800 ? `${text.slice(0, 800)}...` : text;
  } catch {
    return null;
  }
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
  const targetUserIds = Array.from(
    new Set(logs.map((log) => log.targetUserId).filter((id): id is string => Boolean(id)))
  );
  const targetUsers =
    targetUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: targetUserIds } },
          select: {
            id: true,
            name: true,
            handle: true,
          },
        })
      : [];
  const targetUserById = new Map(targetUsers.map((user) => [user.id, user]));

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      targetUserId: log.targetUserId,
      reason: log.reason,
      metadataSummary: metadataSummary(log.metadata),
      adminUser: log.admin,
      targetUser: log.targetUserId ? targetUserById.get(log.targetUserId) ?? null : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
