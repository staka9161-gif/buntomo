import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { createAdminAuditLog } from "@/lib/admin-audit";

const ALLOWED_STATUSES = new Set(["pending", "reviewing", "resolved", "rejected"]);
const CLOSED_STATUSES = new Set(["resolved", "rejected"]);
const MAX_ADMIN_NOTE_LENGTH = 2000;

function normalizeAdminNote(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function truncatePreview(value: string | null | undefined, maxLength = 160) {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

async function getReportDetail(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      targetUserId: true,
      reason: true,
      detail: true,
      status: true,
      adminNote: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
      reporter: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
      targetUser: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
      adminUser: {
        select: {
          id: true,
          name: true,
          handle: true,
        },
      },
    },
  });

  if (!report) return null;

  const chatMessage =
    report.targetType === "BOOK_CHAT_MESSAGE"
      ? await prisma.chatMessage.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            content: true,
            createdAt: true,
            bookId: true,
            workId: true,
            user: {
              select: {
                id: true,
                name: true,
                handle: true,
              },
            },
            book: {
              select: {
                id: true,
                title: true,
              },
            },
            work: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })
      : null;
  const review =
    report.targetType === "REVIEW"
      ? await prisma.review.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            body: true,
            rating: true,
            postedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                handle: true,
              },
            },
            work: {
              select: {
                id: true,
                title: true,
              },
            },
            edition: {
              select: {
                id: true,
                titleOnCover: true,
                publisher: true,
              },
            },
          },
        })
      : null;
  const readingEvent =
    report.targetType === "READING_EVENT"
      ? await prisma.readingEvent.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            title: true,
            eventDate: true,
            prefecture: true,
            location: true,
            url: true,
            organizer: {
              select: {
                id: true,
                name: true,
                handle: true,
              },
            },
            book: {
              select: {
                id: true,
                title: true,
              },
            },
            work: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        })
      : null;
  const directMessage =
    report.targetType === "DIRECT_MESSAGE"
      ? await prisma.directMessage.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                name: true,
                handle: true,
              },
            },
            recipient: {
              select: {
                id: true,
                name: true,
                handle: true,
              },
            },
          },
        })
      : null;

  return {
    ...report,
    targetContext: {
      chatMessage: chatMessage
        ? {
            id: chatMessage.id,
            preview: truncatePreview(chatMessage.content),
            createdAt: chatMessage.createdAt,
            bookId: chatMessage.bookId,
            workId: chatMessage.workId,
            book: chatMessage.book,
            work: chatMessage.work,
            user: chatMessage.user,
          }
        : null,
      review: review
        ? {
            id: review.id,
            preview: truncatePreview(review.body),
            rating: review.rating,
            postedAt: review.postedAt,
            user: review.user,
            work: review.work,
            edition: review.edition,
          }
        : null,
      readingEvent: readingEvent
        ? {
            id: readingEvent.id,
            title: readingEvent.title,
            eventDate: readingEvent.eventDate,
            prefecture: readingEvent.prefecture,
            location: readingEvent.location,
            url: readingEvent.url,
            organizer: readingEvent.organizer,
            book: readingEvent.book,
            work: readingEvent.work,
          }
        : null,
      directMessage: directMessage
        ? {
            id: directMessage.id,
            preview: truncatePreview(directMessage.content),
            createdAt: directMessage.createdAt,
            sender: directMessage.sender,
            recipient: directMessage.recipient,
          }
        : null,
    },
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { reportId } = await params;
  const report = await getReportDetail(reportId);

  if (!report) {
    return NextResponse.json({ error: "通報が見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ report });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { reportId } = await params;
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const adminNote = normalizeAdminNote(body?.adminNote);

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "status が不正です" }, { status: 400 });
  }

  if (adminNote.length > MAX_ADMIN_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `管理者メモは${MAX_ADMIN_NOTE_LENGTH}文字以内で入力してください` },
      { status: 400 }
    );
  }

  if (CLOSED_STATUSES.has(status) && !adminNote) {
    return NextResponse.json(
      { error: "対応済みまたは却下にする場合は管理者メモを入力してください" },
      { status: 400 }
    );
  }

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      targetType: true,
      targetId: true,
      targetUserId: true,
    },
  });

  if (!report) {
    return NextResponse.json({ error: "通報が見つかりません" }, { status: 404 });
  }

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status,
      adminNote: adminNote || null,
      adminUserId: admin.userId,
      resolvedAt: CLOSED_STATUSES.has(status) ? new Date() : null,
    },
    select: {
      id: true,
      status: true,
      adminNote: true,
      adminUserId: true,
      resolvedAt: true,
      updatedAt: true,
    },
  });

  await createAdminAuditLog({
    adminUserId: admin.userId,
    action: "report.updateStatus",
    targetType: "Report",
    targetId: reportId,
    targetUserId: report.targetUserId,
    reason: adminNote || `${report.status} -> ${status}`,
    metadata: {
      previousStatus: report.status,
      newStatus: status,
      reportTargetType: report.targetType,
      reportTargetId: report.targetId,
    },
    request,
  });

  return NextResponse.json({ report: updated });
}
