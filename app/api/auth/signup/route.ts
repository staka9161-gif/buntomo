import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mail";
import { generateRandomHandle } from "@/lib/handle";

const TOKEN_EXPIRY_HOURS = 24;

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "メールアドレス、パスワード、表示名は必須です" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "パスワードは8文字以上にしてください" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    const passwordHash = await bcryptjs.hash(password, 12);

    // ユニークな handle を生成
    let handle: string;
    for (let i = 0; ; i++) {
      handle = generateRandomHandle();
      const dup = await prisma.user.findUnique({ where: { handle } });
      if (!dup) break;
      if (i > 10) throw new Error("handle generation failed");
    }

    const user = await prisma.user.create({
      data: { email, passwordHash, name, handle },
    });

    // メール確認トークンを発行
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    // 確認メール送信（失敗してもユーザー作成は成功扱い）
    try {
      await sendVerificationEmail(email, token);
    } catch (e) {
      console.error("Failed to send verification email:", e);
    }

    return NextResponse.json(
      { success: true, requiresVerification: true, email: user.email },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
