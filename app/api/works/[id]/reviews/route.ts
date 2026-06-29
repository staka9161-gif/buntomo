import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { requireActiveUser } from "@/lib/active-user";

const ALLOWED_VISIBILITIES = new Set(["public", "friends", "private"]);

async function getDefaultReviewVisibility(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultReviewVisibility: true },
  });

  return ALLOWED_VISIBILITIES.has(user?.defaultReviewVisibility ?? "")
    ? user!.defaultReviewVisibility
    : "public";
}

// GET /api/works/:id/reviews
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const viewerId = session?.user?.id ?? null;

    const [reviews, defaultReviewVisibility] = await Promise.all([
      prisma.review.findMany({
      where: {
        workId: id,
        user: { deactivatedAt: null },
        OR: viewerId
          ? [
              { visibility: "public" },
              { userId: viewerId },
              {
                visibility: "friends",
                OR: [
                  {
                    user: {
                      friendshipsRequested: {
                        some: { addresseeId: viewerId, status: "ACCEPTED" },
                      },
                    },
                  },
                  {
                    user: {
                      friendshipsReceived: {
                        some: { requesterId: viewerId, status: "ACCEPTED" },
                      },
                    },
                  },
                ],
              },
            ]
          : [{ visibility: "public" }],
      },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
        edition: {
          select: { id: true, format: true, publisher: true },
        },
      },
      orderBy: { postedAt: "desc" },
      }),
      viewerId ? getDefaultReviewVisibility(viewerId) : Promise.resolve("public"),
    ]);

    const { getDisplayNames } = await import("@/lib/user-display");
    const reviewDisplayNames = await getDisplayNames(reviews.map((r) => r.user.id));
    const enriched = reviews.map((r) => ({
      ...r,
      user: { ...r.user, displayName: reviewDisplayNames.get(r.user.id) ?? r.user.name },
    }));
    return NextResponse.json({ reviews: enriched, defaultReviewVisibility });
  } catch (e) {
    console.error("Reviews GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// POST /api/works/:id/reviews
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }
    const myId = activeUser.userId;

    const { id: workId } = await params;
    const body = await request.json();
    const { edition_id, body: reviewBody, rating } = body;

    if (!reviewBody || reviewBody.trim().length === 0) {
      return NextResponse.json({ error: "レビュー本文は必須です" }, { status: 400 });
    }

    if (rating != null && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: "評価は1〜5の範囲です" }, { status: 400 });
    }

    // Work の存在確認
    const work = await prisma.work.findUnique({ where: { id: workId } });
    if (!work) {
      return NextResponse.json({ error: "作品が見つかりません" }, { status: 404 });
    }

    // edition_id が指定されている場合、その Edition が Work に属しているか確認
    if (edition_id) {
      const edition = await prisma.edition.findUnique({
        where: { id: edition_id },
        select: { workId: true },
      });
      if (!edition || edition.workId !== workId) {
        return NextResponse.json({ error: "この版はこの作品に属していません" }, { status: 400 });
      }
    }

    // 既存レビューがあれば更新、なければ作成
    const existing = await prisma.review.findUnique({
      where: { userId_workId: { userId: myId, workId } },
    });

    const defaultVisibility = await getDefaultReviewVisibility(myId);
    const visibility = typeof body.visibility === "string" ? body.visibility : existing?.visibility ?? defaultVisibility;
    if (!ALLOWED_VISIBILITIES.has(visibility)) {
      return NextResponse.json({ error: "公開範囲が正しくありません" }, { status: 400 });
    }

    const isSpoiler = typeof body.isSpoiler === "boolean" ? body.isSpoiler : existing?.isSpoiler ?? false;

    let review;
    if (existing) {
      review = await prisma.review.update({
        where: { id: existing.id },
        data: {
          body: reviewBody.trim(),
          rating: rating ?? null,
          editionId: edition_id ?? existing.editionId,
          visibility,
          isSpoiler,
        },
        include: {
          user: { select: { id: true, name: true, image: true } },
          edition: { select: { id: true, format: true, publisher: true } },
        },
      });
    } else {
      review = await prisma.review.create({
        data: {
          userId: myId,
          workId,
          editionId: edition_id ?? null,
          body: reviewBody.trim(),
          rating: rating ?? null,
          visibility,
          isSpoiler,
        },
        include: {
          user: { select: { id: true, name: true, image: true } },
          edition: { select: { id: true, format: true, publisher: true } },
        },
      });
    }

    return NextResponse.json({ review }, { status: existing ? 200 : 201 });
  } catch (e) {
    console.error("Reviews POST error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// DELETE /api/works/:id/reviews
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const { id: workId } = await params;

    const work = await prisma.work.findUnique({ where: { id: workId }, select: { id: true } });
    if (!work) {
      return NextResponse.json({ error: "作品が見つかりません" }, { status: 404 });
    }

    const existing = await prisma.review.findUnique({
      where: { userId_workId: { userId: activeUser.userId, workId } },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "感想が見つかりません" }, { status: 404 });
    }

    await prisma.review.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Reviews DELETE error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
