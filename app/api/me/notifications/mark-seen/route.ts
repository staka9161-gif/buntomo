import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { notificationsLastSeenAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Mark-seen error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
