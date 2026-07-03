import { prisma } from "@/lib/db";

function applyMaxDate(map: Map<string, Date>, userId: string | null, value: Date | null | undefined) {
  if (!userId || !value) return;

  const current = map.get(userId);
  if (!current || value.getTime() > current.getTime()) {
    map.set(userId, value);
  }
}

function uniqueUserIds(userIds: string[]) {
  return [...new Set(userIds.filter(Boolean))];
}

export async function getLastUserActivityMap(userIds: string[]): Promise<Map<string, Date>> {
  const ids = uniqueUserIds(userIds);
  const activityByUserId = new Map<string, Date>();

  if (ids.length === 0) {
    return activityByUserId;
  }

  const [
    reviews,
    readings,
    hostedEvents,
    eventInterests,
    chatMessages,
    directMessages,
    reports,
    suspensionAppeals,
    announcementReads,
    mergeSuggestions,
    friendshipsRequested,
    friendshipsReceived,
    blocks,
  ] = await Promise.all([
    prisma.review.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _max: { postedAt: true, updatedAt: true },
    }),
    prisma.readingStatus.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _max: { completedAt: true, updatedAt: true },
    }),
    prisma.readingEvent.groupBy({
      by: ["organizerId"],
      where: { organizerId: { in: ids } },
      _max: { createdAt: true, updatedAt: true },
    }),
    prisma.readingEventInterest.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.chatMessage.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.directMessage.groupBy({
      by: ["senderId"],
      where: { senderId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.report.groupBy({
      by: ["reporterId"],
      where: { reporterId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.suspensionAppeal.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _max: { createdAt: true, updatedAt: true },
    }),
    prisma.importantAnnouncementRead.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _max: { readAt: true },
    }),
    prisma.mergeSuggestion.groupBy({
      by: ["reporterUserId"],
      where: { reporterUserId: { in: ids } },
      _max: { createdAt: true, updatedAt: true },
    }),
    prisma.friendship.groupBy({
      by: ["requesterId"],
      where: { requesterId: { in: ids } },
      _max: { createdAt: true, updatedAt: true },
    }),
    prisma.friendship.groupBy({
      by: ["addresseeId"],
      where: { addresseeId: { in: ids } },
      _max: { createdAt: true, updatedAt: true },
    }),
    prisma.block.groupBy({
      by: ["blockerId"],
      where: { blockerId: { in: ids } },
      _max: { createdAt: true },
    }),
  ]);

  for (const row of reviews) {
    applyMaxDate(activityByUserId, row.userId, row._max.postedAt);
    applyMaxDate(activityByUserId, row.userId, row._max.updatedAt);
  }

  for (const row of readings) {
    applyMaxDate(activityByUserId, row.userId, row._max.completedAt);
    applyMaxDate(activityByUserId, row.userId, row._max.updatedAt);
  }

  for (const row of hostedEvents) {
    applyMaxDate(activityByUserId, row.organizerId, row._max.createdAt);
    applyMaxDate(activityByUserId, row.organizerId, row._max.updatedAt);
  }

  for (const row of eventInterests) {
    applyMaxDate(activityByUserId, row.userId, row._max.createdAt);
  }

  for (const row of chatMessages) {
    applyMaxDate(activityByUserId, row.userId, row._max.createdAt);
  }

  for (const row of directMessages) {
    applyMaxDate(activityByUserId, row.senderId, row._max.createdAt);
  }

  for (const row of reports) {
    applyMaxDate(activityByUserId, row.reporterId, row._max.createdAt);
  }

  for (const row of suspensionAppeals) {
    applyMaxDate(activityByUserId, row.userId, row._max.createdAt);
    applyMaxDate(activityByUserId, row.userId, row._max.updatedAt);
  }

  for (const row of announcementReads) {
    applyMaxDate(activityByUserId, row.userId, row._max.readAt);
  }

  for (const row of mergeSuggestions) {
    applyMaxDate(activityByUserId, row.reporterUserId, row._max.createdAt);
    applyMaxDate(activityByUserId, row.reporterUserId, row._max.updatedAt);
  }

  for (const row of friendshipsRequested) {
    applyMaxDate(activityByUserId, row.requesterId, row._max.createdAt);
    applyMaxDate(activityByUserId, row.requesterId, row._max.updatedAt);
  }

  for (const row of friendshipsReceived) {
    applyMaxDate(activityByUserId, row.addresseeId, row._max.updatedAt);
  }

  for (const row of blocks) {
    applyMaxDate(activityByUserId, row.blockerId, row._max.createdAt);
  }

  return activityByUserId;
}

export async function getLastUserActivity(userId: string): Promise<Date | null> {
  const activityByUserId = await getLastUserActivityMap([userId]);
  return activityByUserId.get(userId) ?? null;
}
