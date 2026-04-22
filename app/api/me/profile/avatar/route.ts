import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { writeFile } from "fs/promises";
import path from "path";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
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

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const fileName = `${session.user.id}.${ext}`;
  const dirPath = path.join(process.cwd(), "data", "avatars");
  const filePath = path.join(dirPath, fileName);

  // 古い拡張子のファイルを削除（png→jpgに変えた場合など）
  const { readdir, unlink } = await import("fs/promises");
  try {
    const files = await readdir(dirPath);
    for (const f of files) {
      if (f.startsWith(session.user.id + ".") && f !== fileName) {
        await unlink(path.join(dirPath, f)).catch(() => {});
      }
    }
  } catch { /* dir might not exist yet */ }

  try {
    const { mkdir } = await import("fs/promises");
    await mkdir(dirPath, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const avatarUrl = `/api/avatars/${fileName}?t=${Date.now()}`;

    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl },
    });

    return NextResponse.json({ avatarUrl });
  } catch {
    return NextResponse.json({ error: "アイコンの保存に失敗しました" }, { status: 500 });
  }
}
