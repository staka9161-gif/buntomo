import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

// GET /api/admin/stats
// Work/Edition の統計情報
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
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
