import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    let avatarDataUrl: string | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // JSON形式（新クライアント）
      const body = await request.json();
      avatarDataUrl = body.avatarDataUrl;
    } else if (contentType.includes("multipart/form-data")) {
      // FormData形式（旧クライアント・キャッシュ対応）
      const formData = await request.formData();
      const file = formData.get("avatar") as File | null;
      if (!file) {
        return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
      }
      // サーバー側でBase64変換（64x64にはできないがそのまま保存）
      const buffer = Buffer.from(await file.arrayBuffer());
      // 50KB以下に切り詰め
      if (buffer.length > 50000) {
        return NextResponse.json({ error: "画像が大きすぎます。ブラウザを再読み込み（Ctrl+Shift+R）してください。" }, { status: 400 });
      }
      avatarDataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    }

    if (!avatarDataUrl || !avatarDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "無効な画像データです" }, { status: 400 });
    }

    if (avatarDataUrl.length > 150000) {
      return NextResponse.json({ error: "画像が大きすぎます" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: avatarDataUrl },
    });

    return NextResponse.json({ image: avatarDataUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Avatar upload error:", msg);
    return NextResponse.json({ error: `アイコンの保存に失敗しました: ${msg.slice(0, 500)}` }, { status: 500 });
  }
}
