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

type ImpressionTarget =
  | {
      bookId: string;
      workId: string | null;
      editionId: string | null;
    }
  | { error: "book_not_found" | "not_completed" };

async function resolveImpressionTarget(bookId: string, userId: string): Promise<ImpressionTarget> {
  const [book, reading] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, migratedWorkId: true },
    }),
    prisma.readingStatus.findFirst({
      where: {
        userId,
        bookId,
        status: "COMPLETED",
      },
      select: {
        workId: true,
        editionId: true,
        book: {
          select: {
            migratedWorkId: true,
          },
        },
        edition: {
          select: {
            workId: true,
          },
        },
      },
    }),
  ]);

  if (!book) {
    return { error: "book_not_found" };
  }

  if (!reading) {
    return { error: "not_completed" };
  }

  return {
    bookId: book.id,
    workId:
      reading.workId ??
      reading.edition?.workId ??
      reading.book?.migratedWorkId ??
      book.migratedWorkId ??
      null,
    editionId: reading.editionId,
  };
}

function targetErrorResponse(error: "book_not_found" | "not_completed") {
  if (error === "book_not_found") {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json(
    { error: "Only completed books can have impressions" },
    { status: 403 }
  );
}

async function findOwnReview(userId: string, target: { workId: string | null; bookId: string }) {
  if (target.workId) {
    return prisma.review.findUnique({
      where: { userId_workId: { userId, workId: target.workId } },
      include: {
        user: { select: { id: true, name: true, image: true } },
        edition: { select: { id: true, format: true, publisher: true } },
      },
    });
  }

  return prisma.review.findUnique({
    where: { userId_bookId: { userId, bookId: target.bookId } },
    include: {
      user: { select: { id: true, name: true, image: true } },
      edition: { select: { id: true, format: true, publisher: true } },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const { id: bookId } = await params;
    const target = await resolveImpressionTarget(bookId, session.user.id);
    if ("error" in target) {
      return targetErrorResponse(target.error);
    }

    const [review, defaultVisibility] = await Promise.all([
      findOwnReview(session.user.id, target),
      getDefaultReviewVisibility(session.user.id),
    ]);
    return NextResponse.json({ review, defaultVisibility });
  } catch (error) {
    console.error("Book impression GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const { id: bookId } = await params;
    const target = await resolveImpressionTarget(bookId, activeUser.userId);
    if ("error" in target) {
      return targetErrorResponse(target.error);
    }

    const payload = await request.json();
    const reviewBody = typeof payload.body === "string" ? payload.body.trim() : "";
    const rating = payload.rating ?? null;
    const editionId = payload.editionId ?? payload.edition_id ?? target.editionId ?? null;

    if (!reviewBody) {
      return NextResponse.json({ error: "Body is required" }, { status: 400 });
    }

    if (rating != null && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    if (target.workId) {
      const work = await prisma.work.findUnique({
        where: { id: target.workId },
        select: { id: true },
      });
      if (!work) {
        return NextResponse.json({ error: "Work not found" }, { status: 404 });
      }
    }

    if (editionId && target.workId) {
      const edition = await prisma.edition.findUnique({
        where: { id: editionId },
        select: { workId: true },
      });
      if (!edition || edition.workId !== target.workId) {
        return NextResponse.json({ error: "Edition does not belong to this work" }, { status: 400 });
      }
    }

    const [existing, defaultVisibility] = await Promise.all([
      findOwnReview(activeUser.userId, target),
      getDefaultReviewVisibility(activeUser.userId),
    ]);
    const visibility =
      typeof payload.visibility === "string" ? payload.visibility : existing?.visibility ?? defaultVisibility;
    if (!ALLOWED_VISIBILITIES.has(visibility)) {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
    }

    const isSpoiler =
      typeof payload.isSpoiler === "boolean" ? payload.isSpoiler : existing?.isSpoiler ?? false;

    const review = existing
      ? await prisma.review.update({
          where: { id: existing.id },
          data: {
            body: reviewBody,
            rating,
            editionId: target.workId ? editionId : null,
            visibility,
            isSpoiler,
          },
          include: {
            user: { select: { id: true, name: true, image: true } },
            edition: { select: { id: true, format: true, publisher: true } },
          },
        })
      : await prisma.review.create({
          data: {
            userId: activeUser.userId,
            workId: target.workId,
            bookId: target.workId ? null : target.bookId,
            editionId: target.workId ? editionId : null,
            body: reviewBody,
            rating,
            visibility,
            isSpoiler,
          },
          include: {
            user: { select: { id: true, name: true, image: true } },
            edition: { select: { id: true, format: true, publisher: true } },
          },
        });

    return NextResponse.json({ review }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Book impression POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    const { id: bookId } = await params;
    const target = await resolveImpressionTarget(bookId, activeUser.userId);
    if ("error" in target) {
      return targetErrorResponse(target.error);
    }

    const existing = await findOwnReview(activeUser.userId, target);
    if (!existing) {
      return NextResponse.json({ error: "Impression not found" }, { status: 404 });
    }

    await prisma.review.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Book impression DELETE error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
