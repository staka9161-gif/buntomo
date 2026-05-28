import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailNotifDM: true,
        emailNotifFriendRequest: true,
        emailNotifFriendAccepted: true,
      },
    });

    return NextResponse.json({ settings: user });
  } catch (e) {
    console.error("Notification settings GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const body = await request.json();

    const data: Record<string, boolean> = {};
    if (typeof body.emailNotifDM === "boolean") data.emailNotifDM = body.emailNotifDM;
    if (typeof body.emailNotifFriendRequest === "boolean") data.emailNotifFriendRequest = body.emailNotifFriendRequest;
    if (typeof body.emailNotifFriendAccepted === "boolean") data.emailNotifFriendAccepted = body.emailNotifFriendAccepted;

    await prisma.user.update({
      where: { id: session.user.id },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Notification settings PATCH error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
