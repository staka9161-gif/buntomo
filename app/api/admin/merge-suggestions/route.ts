import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

// GET /api/admin/merge-suggestions?status=pending
// MergeSuggestion 一覧取得
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
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
