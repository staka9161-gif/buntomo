import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mail";

const TOKEN_EXPIRY_HOURS = 1;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスは必須です" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // ユーザーが存在しなくても同じレスポンスを返す（メールアドレスの存在を漏らさない）
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // 既存の未使用トークンを削除
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // 新しいトークンを生成
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // メール送信を試みる。SMTP未設定の場合はコンソールにリンクを出力
    if (process.env.SMTP_USER) {
      await sendPasswordResetEmail(user.email, token);
    } else {
      console.log("\n========================================");
      console.log("パスワードリセットリンク（SMTP未設定のため画面表示）:");
      console.log(resetUrl);
      console.log("有効期限:", expiresAt.toLocaleString("ja-JP"));
      console.log("========================================\n");
      // SMTP未設定時はリンクを直接レスポンスに含める（開発用）
      return NextResponse.json({ success: true, resetUrl });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Password reset request failed:", e);
    return NextResponse.json(
      { error: "メールの送信に失敗しました。SMTP設定を確認してください。" },
      { status: 500 }
    );
  }
}
