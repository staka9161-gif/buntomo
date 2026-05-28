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

    const result = await prisma.user.deleteMany({
      where: { scheduledDeletionAt: { lte: new Date() } },
    });

    console.log(`[purge-accounts] Deleted ${result.count} account(s)`);
    return NextResponse.json({ deleted: result.count });
  } catch (e) {
    console.error("[purge-accounts] Error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
