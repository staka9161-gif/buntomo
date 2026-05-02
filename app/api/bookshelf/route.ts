import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/bookshelf
// Edition 単位で本棚に登録。edition_id から work_id を解決。
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { edition_id, status, started_at } = body;

    if (!edition_id || !status) {
      return NextResponse.json(
        { error: "edition_id と status は必須です" },
        { status: 400 }
      );
    }

    const validStatuses = ["WANT_TO_READ", "READING", "COMPLETED", "DNF"];
    const normalizedStatus = status.toUpperCase();
    if (!validStatuses.includes(normalizedStatus)) {
      return NextResponse.json(
        { error: `status は ${validStatuses.join(", ")} のいずれかです` },
        { status: 400 }
      );
    }

    // Edition を取得して work_id を解決
    const edition = await prisma.edition.findUnique({
      where: { id: edition_id },
      select: { id: true, workId: true },
    });

    if (!edition) {
      return NextResponse.json({ error: "版が見つかりません" }, { status: 404 });
    }

    // 同一 Work に既に登録済みかチェック
    const existing = await prisma.readingStatus.findFirst({
      where: { userId: session.user.id, workId: edition.workId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "この作品は既に本棚に登録されています", existing_edition_id: existing.editionId },
        { status: 409 }
      );
    }

    const reading = await prisma.readingStatus.create({
      data: {
        userId: session.user.id,
        workId: edition.workId,
        editionId: edition.id,
        status: normalizedStatus,
        startedAt: normalizedStatus === "READING" ? (started_at ? new Date(started_at) : new Date()) : null,
        completedAt: normalizedStatus === "COMPLETED" ? new Date() : null,
      },
      include: {
        edition: true,
        work: { select: { id: true, title: true, author: true } },
      },
    });

    return NextResponse.json({ reading }, { status: 201 });
  } catch (e) {
    console.error("Bookshelf POST error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
