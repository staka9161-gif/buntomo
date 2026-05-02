import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/works/search?q=<query>
// Work をタイトル/著者で検索（MergeSuggestion 報告時の候補検索用）
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ works: [] });
    }

    const works = await prisma.work.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { author: { contains: q, mode: "insensitive" } },
          { titleNormalized: { contains: q.toLowerCase() } },
        ],
      },
      select: {
        id: true,
        title: true,
        author: true,
        editions: {
          select: { coverImageUrl: true },
          take: 1,
        },
      },
      take: 10,
      orderBy: { title: "asc" },
    });

    return NextResponse.json({
      works: works.map((w) => ({
        id: w.id,
        title: w.title,
        author: w.author,
        coverImageUrl: w.editions[0]?.coverImageUrl || null,
      })),
    });
  } catch (e) {
    console.error("Works search error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
