import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcryptjs from "bcryptjs";

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const now = new Date();
    const deletionDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        deactivatedAt: now,
        scheduledDeletionAt: deletionDate,
      },
    });

    return NextResponse.json({ message: "退会手続きが完了しました。30日以内にログインすると復元できます。30日を過ぎるとアカウント情報等の削除処理が行われます。" });
  } catch (e) {
    console.error("Account DELETE error:", e);
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
    const { currentPassword, newEmail, newPassword, newPasswordConfirm } = body;

    if (!currentPassword) {
      return NextResponse.json(
        { error: "現在のパスワードを入力してください" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "このアカウントはGoogleログインで作成されています。パスワードやメールアドレスの変更はできません。" },
        { status: 400 }
      );
    }

    const isValid = await bcryptjs.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "現在のパスワードが正しくありません" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // メールアドレス変更
    if (newEmail !== undefined && newEmail !== user.email) {
      const trimmed = newEmail.trim().toLowerCase();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return NextResponse.json(
          { error: "有効なメールアドレスを入力してください" },
          { status: 400 }
        );
      }
      const existing = await prisma.user.findUnique({
        where: { email: trimmed },
      });
      if (existing) {
        return NextResponse.json(
          { error: "このメールアドレスはすでに使用されています" },
          { status: 409 }
        );
      }
      updateData.email = trimmed;
    }

    // パスワード変更
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "新しいパスワードは8文字以上にしてください" },
          { status: 400 }
        );
      }
      if (newPassword !== newPasswordConfirm) {
        return NextResponse.json(
          { error: "新しいパスワードが一致しません" },
          { status: 400 }
        );
      }
      updateData.passwordHash = await bcryptjs.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "変更はありません" });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });
    return NextResponse.json({ message: "アカウント情報を更新しました" });
  } catch (e) {
    console.error("Account PATCH error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
