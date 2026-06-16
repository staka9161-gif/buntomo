import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AdminUserStatusFilter = "all" | "active" | "deactivated" | "admin";

export const adminUserStatusFilters: AdminUserStatusFilter[] = [
  "all",
  "active",
  "deactivated",
  "admin",
];

export type AdminUsersQuery = {
  query?: string | null;
  status?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

function clampPositiveInt(value: string | number | null | undefined, fallback: number, max?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  const integer = Math.floor(parsed);
  return max ? Math.min(integer, max) : integer;
}

export function normalizeAdminUserStatus(status: string | null | undefined): AdminUserStatusFilter {
  return adminUserStatusFilters.includes(status as AdminUserStatusFilter)
    ? (status as AdminUserStatusFilter)
    : "all";
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "***";

  const prefix = local.includes(".")
    ? local.slice(0, local.indexOf(".") + 1)
    : local.slice(0, Math.min(local.length, 2));

  return `${prefix || "*"}***@${domain}`;
}

function buildUserWhere(query: string, status: AdminUserStatusFilter): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { handle: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  if (status === "active") {
    where.deactivatedAt = null;
  } else if (status === "deactivated") {
    where.deactivatedAt = { not: null };
  } else if (status === "admin") {
    where.isAdmin = true;
  }

  return where;
}

export async function getAdminUsers(queryParams: AdminUsersQuery) {
  const query = String(queryParams.query ?? "").trim();
  const status = normalizeAdminUserStatus(queryParams.status);
  const page = clampPositiveInt(queryParams.page, 1);
  const pageSize = clampPositiveInt(queryParams.pageSize, 20, 50);
  const where = buildUserWhere(query, status);
  const skip = (page - 1) * pageSize;

  const [totalUsers, activeUsers, deactivatedUsers, adminUsers, total, users] =
    await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { deactivatedAt: null } }),
      prisma.user.count({ where: { deactivatedAt: { not: null } } }),
      prisma.user.count({ where: { isAdmin: true } }),
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          handle: true,
          email: true,
          isAdmin: true,
          emailVerified: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
          deactivatedAt: true,
          scheduledDeletionAt: true,
          _count: {
            select: {
              readings: true,
              friendshipsRequested: { where: { status: "ACCEPTED" } },
              friendshipsReceived: { where: { status: "ACCEPTED" } },
            },
          },
        },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      handle: user.handle,
      maskedEmail: maskEmail(user.email),
      isAdmin: user.isAdmin,
      emailVerified: Boolean(user.emailVerified),
      isPublic: user.isPublic,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deactivatedAt: user.deactivatedAt,
      scheduledDeletionAt: user.scheduledDeletionAt,
      readingCount: user._count.readings,
      friendCount: user._count.friendshipsRequested + user._count.friendshipsReceived,
    })),
    summary: {
      totalUsers,
      activeUsers,
      deactivatedUsers,
      adminUsers,
    },
    total,
    page,
    pageSize,
    totalPages,
    query,
    status,
  };
}
