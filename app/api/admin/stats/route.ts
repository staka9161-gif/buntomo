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
    });
  } catch (e) {
    console.error("Admin stats error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
