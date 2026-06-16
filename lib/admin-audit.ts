import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

type CreateAdminAuditLogInput = {
  adminUserId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetUserId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: Request;
};

function getClientIp(request?: Request): string | null {
  if (!request) return null;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return request.headers.get("x-real-ip")?.trim() || null;
}

function truncate(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export async function createAdminAuditLog(input: CreateAdminAuditLogInput) {
  try {
    const metadata = input.metadata
      ? (input.metadata as Prisma.InputJsonObject)
      : undefined;

    // Store only small, non-sensitive context. Do not include message bodies,
    // email contents, tokens, or detailed personal information in metadata.
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        targetUserId: input.targetUserId ?? null,
        reason: input.reason ?? null,
        metadata,
        ipAddress: truncate(getClientIp(input.request), 128),
        userAgent: truncate(input.request?.headers.get("user-agent") ?? null, 512),
      },
    });
  } catch (error) {
    console.error("Failed to create admin audit log:", error);
  }
}
