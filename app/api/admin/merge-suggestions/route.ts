import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

// GET /api/admin/merge-suggestions?status=pending
// MergeSuggestion 一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get("status") || "pending";

    const suggestions = await prisma.mergeSuggestion.findMany({
      where: { status: status as "pending" | "approved" | "rejected" },
      include: {
        sourceWork: {
          select: {
            id: true,
            title: true,
            author: true,
            editions: { select: { coverImageUrl: true }, take: 1 },
          },
        },
        targetWork: {
          select: {
            id: true,
            title: true,
            author: true,
            editions: { select: { coverImageUrl: true }, take: 1 },
          },
        },
        reporter: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("MergeSuggestions GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
