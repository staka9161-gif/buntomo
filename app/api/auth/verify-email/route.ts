import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/verify-email?status=invalid`);
  }

  try {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, emailVerified: true } } },
    });

    if (!record) {
      // トークンが見つからない → 既に使用済み or 無効
      return NextResponse.redirect(`${baseUrl}/verify-email?status=invalid`);
    }

    // 既に確認済みのユーザー（メールクライアントのプリフェッチ等で2回目）
    if (record.user.emailVerified) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: record.user.id } });
      return NextResponse.redirect(`${baseUrl}/verify-email?status=already_verified`);
    }

    // 期限切れ
    if (record.expiresAt < new Date()) {
      await prisma.emailVerificationToken.delete({ where: { id: record.id } });
      return NextResponse.redirect(`${baseUrl}/verify-email?status=expired`);
    }

    // 検証成功
    await prisma.user.update({
      where: { id: record.user.id },
      data: { emailVerified: new Date() },
    });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: record.user.id } });

    return NextResponse.redirect(`${baseUrl}/verify-email?status=success`);
  } catch (e) {
    console.error("Email verification error:", e);
    return NextResponse.redirect(`${baseUrl}/verify-email?status=invalid`);
  }
}
