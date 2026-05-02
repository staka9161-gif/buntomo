import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/works/:id
// Work 基本情報 + editions(TranslationGroup別) + stats + edition_distribution + user_context
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const work = await prisma.work.findUnique({
      where: { id },
      include: {
        editions: {
          include: {
            translationGroup: true,
          },
          orderBy: { publishedAt: "asc" },
        },
        translationGroups: {
          orderBy: { firstPublishedYear: "asc" },
        },
      },
    });

    if (!work) {
      return NextResponse.json({ error: "作品が見つかりません" }, { status: 404 });
    }

    // stats: 読者数の集計
    const [readingStats, reviewStats] = await Promise.all([
      prisma.readingStatus.groupBy({
        by: ["status"],
        where: { workId: id },
        _count: true,
      }),
      prisma.review.aggregate({
        where: { workId: id },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    const currentlyReadingCount = readingStats.find((s) => s.status === "READING")?._count ?? 0;
    const completedCount = readingStats.find((s) => s.status === "COMPLETED")?._count ?? 0;
    const wantToReadCount = readingStats.find((s) => s.status === "WANT_TO_READ")?._count ?? 0;
    const totalReadersCount = currentlyReadingCount + completedCount + wantToReadCount;

    const stats = {
      currently_reading_count: currentlyReadingCount,
      completed_count: completedCount,
      want_to_read_count: wantToReadCount,
      total_readers_count: totalReadersCount,
      average_rating: reviewStats._avg.rating,
      review_count: reviewStats._count,
    };

    // edition_distribution: 版ごとの読者割合
    const editionCounts = await prisma.readingStatus.groupBy({
      by: ["editionId"],
      where: { workId: id, editionId: { not: null } },
      _count: true,
    });

    const totalEditionReaders = editionCounts.reduce((sum, c) => sum + c._count, 0);
    const editionDistribution = editionCounts
      .filter((c) => c.editionId)
      .map((c) => ({
        edition_id: c.editionId!,
        count: c._count,
        percentage: totalEditionReaders > 0 ? c._count / totalEditionReaders : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // user_context: ログインユーザーの登録状況
    let userContext = null;
    if (session?.user?.id) {
      const userReading = await prisma.readingStatus.findFirst({
        where: { userId: session.user.id, workId: id },
        select: { editionId: true, status: true, currentPage: true, rating: true },
      });
      if (userReading) {
        userContext = userReading;
      }
    }

    // editions を TranslationGroup ごとにグループ化
    const editionsByGroup: Record<string, typeof work.editions> = {};
    for (const edition of work.editions) {
      const groupKey = edition.translationGroupId || "default";
      if (!editionsByGroup[groupKey]) editionsByGroup[groupKey] = [];
      editionsByGroup[groupKey].push(edition);
    }

    return NextResponse.json({
      work: {
        id: work.id,
        title: work.title,
        author: work.author,
        originalTitle: work.originalTitle,
        originalLanguage: work.originalLanguage,
        description: work.description,
        createdAt: work.createdAt,
      },
      editions: work.editions,
      editions_by_group: editionsByGroup,
      translation_groups: work.translationGroups,
      stats,
      edition_distribution: editionDistribution,
      user_context: userContext,
    });
  } catch (e) {
    console.error("Work GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
