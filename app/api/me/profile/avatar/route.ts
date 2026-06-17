import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveUser } from "@/lib/active-user";

export async function POST(request: NextRequest) {
  try {
    const activeUser = await requireActiveUser();
    if (!activeUser.ok) {
      return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
    }

    let avatarDataUrl: string | null = null;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      avatarDataUrl =
        typeof body?.avatarDataUrl === "string" ? body.avatarDataUrl : null;
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("avatar") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "ファイルが選択されていません" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length > 50000) {
        return NextResponse.json(
          { error: "画像が大きすぎます。ブラウザを再読み込みしてから再度お試しください。" },
          { status: 400 }
        );
      }

      avatarDataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    }

    if (!avatarDataUrl || !avatarDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "無効な画像データです" },
        { status: 400 }
      );
    }

    if (avatarDataUrl.length > 150000) {
      return NextResponse.json(
        { error: "画像が大きすぎます" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: activeUser.userId },
      data: { image: avatarDataUrl },
    });

    return NextResponse.json({ image: avatarDataUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Avatar upload error:", msg);
    return NextResponse.json(
      { error: `アイコンの保存に失敗しました: ${msg.slice(0, 500)}` },
      { status: 500 }
    );
  }
}
