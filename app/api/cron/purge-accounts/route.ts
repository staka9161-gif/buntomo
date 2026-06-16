export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const now = new Date();
    const targetUsers = await prisma.user.findMany({
      where: {
        deactivatedAt: { not: null },
        scheduledDeletionAt: { lte: now },
      },
      select: {
        id: true,
        deactivatedAt: true,
        scheduledDeletionAt: true,
      },
    });

    if (targetUsers.length === 0) {
      console.log("[purge-accounts] No accounts to purge");
      return NextResponse.json({
        ok: true,
        purgedUsers: 0,
        anonymizedLearningSignals: 0,
      });
    }

    const userIds = targetUsers.map((user) => user.id);

    const learningSignals = await prisma.learningSignal.updateMany({
      where: { userId: { in: userIds } },
      data: { userId: null },
    });

    const deletedUsers = await prisma.user.deleteMany({
      where: {
        id: { in: userIds },
        deactivatedAt: { not: null },
        scheduledDeletionAt: { lte: now },
      },
    });

    console.log(
      `[purge-accounts] Deleted ${deletedUsers.count} account(s), anonymized ${learningSignals.count} learning signal(s)`
    );
    return NextResponse.json({
      ok: true,
      purgedUsers: deletedUsers.count,
      anonymizedLearningSignals: learningSignals.count,
    });
  } catch (e) {
    console.error("[purge-accounts] Error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
