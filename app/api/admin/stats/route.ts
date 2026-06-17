import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

// GET /api/admin/stats
// Work/Edition の統計情報
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const [
      workCount,
      editionCount,
      bookCount,
      migratedBookCount,
      pendingSuggestions,
      approvedSuggestions,
      rejectedSuggestions,
      worksWithMultipleEditions,
      translationGroupCount,
      reportTotal,
      reportPending,
      reportReviewing,
      reportResolved,
      reportRejected,
      suspendedUsers,
      deactivatedUsers,
      scheduledDeletionUsers,
      recentPendingReports,
    ] = await Promise.all([
      prisma.work.count(),
      prisma.edition.count(),
      prisma.book.count(),
      prisma.book.count({ where: { migratedWorkId: { not: null } } }),
      prisma.mergeSuggestion.count({ where: { status: "pending" } }),
      prisma.mergeSuggestion.count({ where: { status: "approved" } }),
      prisma.mergeSuggestion.count({ where: { status: "rejected" } }),
      prisma.edition.groupBy({
        by: ["workId"],
        _count: true,
        having: { workId: { _count: { gt: 1 } } },
      }),
      prisma.translationGroup.count(),
      prisma.report.count(),
      prisma.report.count({ where: { status: "pending" } }),
      prisma.report.count({ where: { status: "reviewing" } }),
      prisma.report.count({ where: { status: "resolved" } }),
      prisma.report.count({ where: { status: "rejected" } }),
      prisma.user.count({ where: { accountStatus: "suspended", deactivatedAt: null } }),
      prisma.user.count({ where: { deactivatedAt: { not: null } } }),
      prisma.user.count({ where: { scheduledDeletionAt: { not: null } } }),
      prisma.report.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          targetType: true,
          reason: true,
          status: true,
          createdAt: true,
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

    return NextResponse.json({
      works: workCount,
      editions: editionCount,
      books_total: bookCount,
      books_migrated: migratedBookCount,
      books_pending_migration: bookCount - migratedBookCount,
      merge_suggestions: {
        pending: pendingSuggestions,
        approved: approvedSuggestions,
        rejected: rejectedSuggestions,
      },
      works_with_multiple_editions: worksWithMultipleEditions.length,
      translation_groups: translationGroupCount,
      reportStats: {
        total: reportTotal,
        pending: reportPending,
        reviewing: reportReviewing,
        resolved: reportResolved,
        rejected: reportRejected,
      },
      userModerationStats: {
        suspended: suspendedUsers,
        deactivated: deactivatedUsers,
        scheduledDeletion: scheduledDeletionUsers,
      },
      recentPendingReports,
    });
  } catch (e) {
    console.error("Admin stats error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
