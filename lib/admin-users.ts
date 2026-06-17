import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AdminUserStatusFilter = "all" | "active" | "suspended" | "deactivated" | "admin";

export const adminUserStatusFilters: AdminUserStatusFilter[] = [
  "all",
  "active",
  "suspended",
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

function safeParseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeCustomLinks(value: string | null) {
  const parsed = safeParseJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((link): link is { label?: unknown; url?: unknown } => {
      return typeof link === "object" && link !== null;
    })
    .map((link) => ({
      label: typeof link.label === "string" ? link.label : "",
      url: typeof link.url === "string" ? link.url : "",
    }))
    .filter((link) => link.label || link.url);
}

function normalizeVisibility(value: string | null) {
  const parsed = safeParseJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const entries = Object.entries(parsed)
    .filter(([, visibility]) => typeof visibility === "string")
    .map(([field, visibility]) => ({ field, visibility: visibility as string }));

  return entries.length > 0 ? entries : null;
}

function hasStoredImage(value: string | null) {
  return Boolean(value && !value.startsWith("data:"));
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
    where.accountStatus = "active";
  } else if (status === "suspended") {
    where.deactivatedAt = null;
    where.accountStatus = "suspended";
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

  const [totalUsers, activeUsers, suspendedUsers, deactivatedUsers, adminUsers, total, users] =
    await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { deactivatedAt: null, accountStatus: "active" } }),
      prisma.user.count({ where: { deactivatedAt: null, accountStatus: "suspended" } }),
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
          accountStatus: true,
          suspendedAt: true,
          suspendedReason: true,
          suspendedUntil: true,
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
      accountStatus: user.accountStatus,
      suspendedAt: user.suspendedAt,
      suspendedReason: user.suspendedReason,
      suspendedUntil: user.suspendedUntil,
      readingCount: user._count.readings,
      friendCount: user._count.friendshipsRequested + user._count.friendshipsReceived,
    })),
    summary: {
      totalUsers,
      activeUsers,
      suspendedUsers,
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

export async function getAdminUserDetail(userId: string) {
  const [
    user,
    readingTotal,
    readingNow,
    completedReadings,
    booklessReadings,
    reviewCount,
    hostedEventCount,
    acceptedFriendshipsRequested,
    acceptedFriendshipsReceived,
    dmSentCount,
    dmReceivedCount,
    dmPairs,
    reportTotal,
    pendingReports,
    reviewingReports,
    resolvedReports,
    rejectedReports,
    recentReports,
  ] = await prisma.$transaction([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        handle: true,
        email: true,
        image: true,
        isAdmin: true,
        emailVerified: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        deactivatedAt: true,
        scheduledDeletionAt: true,
        accountStatus: true,
        suspendedAt: true,
        suspendedReason: true,
        suspendedUntil: true,
        bio: true,
        area: true,
        linkX: true,
        linkInstagram: true,
        linkWebsite: true,
        linkWebsiteLabel: true,
        customLinks: true,
        visibility: true,
      },
    }),
    prisma.readingStatus.count({ where: { userId } }),
    prisma.readingStatus.count({ where: { userId, status: "READING" } }),
    prisma.readingStatus.count({ where: { userId, status: "COMPLETED" } }),
    prisma.readingStatus.count({ where: { userId, bookId: null } }),
    prisma.review.count({ where: { userId } }),
    prisma.readingEvent.count({ where: { organizerId: userId } }),
    prisma.friendship.count({ where: { requesterId: userId, status: "ACCEPTED" } }),
    prisma.friendship.count({ where: { addresseeId: userId, status: "ACCEPTED" } }),
    prisma.directMessage.count({ where: { senderId: userId } }),
    prisma.directMessage.count({ where: { recipientId: userId } }),
    prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      select: {
        senderId: true,
        recipientId: true,
      },
    }),
    prisma.report.count({ where: { targetUserId: userId } }),
    prisma.report.count({ where: { targetUserId: userId, status: "pending" } }),
    prisma.report.count({ where: { targetUserId: userId, status: "reviewing" } }),
    prisma.report.count({ where: { targetUserId: userId, status: "resolved" } }),
    prisma.report.count({ where: { targetUserId: userId, status: "rejected" } }),
    prisma.report.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        targetType: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reporter: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
      },
    }),
  ]);

  if (!user) return null;

  const conversationIds = new Set(
    dmPairs.map((message) => (message.senderId === userId ? message.recipientId : message.senderId))
  );

  return {
    user: {
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
      accountStatus: user.accountStatus,
      suspendedAt: user.suspendedAt,
      suspendedReason: user.suspendedReason,
      suspendedUntil: user.suspendedUntil,
      hasImage: Boolean(user.image),
      hasExternalImage: hasStoredImage(user.image),
      bio: user.bio,
      area: user.area,
      linkX: user.linkX,
      linkInstagram: user.linkInstagram,
      linkWebsite: user.linkWebsite,
      linkWebsiteLabel: user.linkWebsiteLabel,
      customLinks: normalizeCustomLinks(user.customLinks),
      customLinkCount: normalizeCustomLinks(user.customLinks).length,
      visibility: normalizeVisibility(user.visibility),
      visibilityParseFailed: Boolean(user.visibility && !normalizeVisibility(user.visibility)),
    },
    activity: {
      readingTotal,
      readingNow,
      completedReadings,
      booklessReadings,
      reviewCount,
      hostedEventCount,
      attendingEventCount: null as number | null,
      friendCount: acceptedFriendshipsRequested + acceptedFriendshipsReceived,
      directMessageCount: dmSentCount + dmReceivedCount,
      directMessageConversationCount: conversationIds.size,
    },
    reportSummary: {
      total: reportTotal,
      pending: pendingReports,
      reviewing: reviewingReports,
      resolved: resolvedReports,
      rejected: rejectedReports,
    },
    recentReports,
  };
}
