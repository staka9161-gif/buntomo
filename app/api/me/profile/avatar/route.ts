import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { avatarDataUrl } = await request.json();

    if (!avatarDataUrl || !avatarDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "無効な画像データです" }, { status: 400 });
    }

    // data URL のサイズチェック（50KB以下）
    if (avatarDataUrl.length > 70000) {
      return NextResponse.json({ error: "画像が大きすぎます" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: avatarDataUrl },
    });

    return NextResponse.json({ avatarUrl: avatarDataUrl });
  } catch (e) {
    console.error("Avatar upload error:", e);
    return NextResponse.json({ error: "アイコンの保存に失敗しました" }, { status: 500 });
  }
}
