import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_STORED_SIZE = 100 * 1024; // DB保存は100KB以下に圧縮

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "JPEG、PNG、WebP、GIF のみ対応しています" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "ファイルサイズは2MB以内にしてください" }, { status: 400 });
    }

    let buffer = Buffer.from(await file.arrayBuffer());
    let mimeType = file.type;

    // 画像が大きい場合はCanvasで縮小（サーバーサイドではCanvasが使えないので、
    // 単純にサイズが大きすぎる場合は品質を下げてJPEGに変換）
    // Node.jsではsharpなどの画像処理ライブラリが必要だが、
    // Vercelではインストールが面倒なので、クライアント側で縮小するのが現実的。
    // ここではサイズチェックのみ行い、大きすぎる場合はエラーを返す。
    if (buffer.length > MAX_STORED_SIZE) {
      return NextResponse.json(
        { error: "画像を小さくしてください（100KB以下推奨）。スマホの場合は画像を編集してサイズを縮小してからアップロードしてください。" },
        { status: 400 }
      );
    }

    // Base64 data URL として DB に保存
    const base64 = buffer.toString("base64");
    const avatarUrl = `data:${mimeType};base64,${base64}`;

    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl },
    });

    return NextResponse.json({ avatarUrl });
  } catch (e) {
    console.error("Avatar upload error:", e);
    return NextResponse.json({ error: "アイコンの保存に失敗しました" }, { status: 500 });
  }
}
