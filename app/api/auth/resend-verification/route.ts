import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mail";

const TOKEN_EXPIRY_HOURS = 24;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1分

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    // ユーザーが存在しない or 既に確認済み → サイレント成功
    if (!user || user.emailVerified) {
      return NextResponse.json({ success: true });
    }

    // 簡易レート制限: 直近1分以内にトークンが作成されていたら拒否
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
      },
    });
    if (recentToken) {
      return NextResponse.json(
        { error: "しばらく待ってから再度お試しください" },
        { status: 429 }
      );
    }

    // 既存トークンを全て削除
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

    // 新しいトークンを生成
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    await sendVerificationEmail(email, token);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Resend verification error:", e);
    return NextResponse.json(
      { error: "メールの送信に失敗しました" },
      { status: 500 }
    );
  }
}
