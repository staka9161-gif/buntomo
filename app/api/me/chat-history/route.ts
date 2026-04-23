import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// ユーザーがチャットに参加した本を最終発言順で返す
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    // ユーザーのメッセージがある全bookIdと最終発言日時を取得
    const messages = await prisma.chatMessage.findMany({
      where: { userId: session.user.id },
      select: { bookId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // bookIdごとに最終発言日時と発言数を集計
    const bookMap = new Map<string, { lastMessageAt: Date; messageCount: number }>();
    for (const m of messages) {
      const existing = bookMap.get(m.bookId);
      if (!existing) {
        bookMap.set(m.bookId, { lastMessageAt: m.createdAt, messageCount: 1 });
      } else {
        existing.messageCount++;
      }
    }

    if (bookMap.size === 0) {
      return NextResponse.json({ chatHistory: [] });
    }

    const bookIds = [...bookMap.keys()];

    // 本の情報を取得
    const books = await prisma.book.findMany({
      where: { id: { in: bookIds } },
      select: {
        id: true,
        title: true,
        author: true,
        coverImageUrl: true,
      },
    });

    // 各本の全体メッセージ数も取得
    const totalCounts = await prisma.chatMessage.groupBy({
      by: ["bookId"],
      where: { bookId: { in: bookIds } },
      _count: true,
    });
    const totalCountMap = new Map(totalCounts.map((c) => [c.bookId, c._count]));

    // 最終発言順でソート
    const chatHistory = books
      .filter((book) => bookMap.has(book.id))
      .map((book) => {
        const stats = bookMap.get(book.id)!;
        return {
          book: {
            id: book.id,
            title: book.title,
            author: book.author,
            coverImageUrl: book.coverImageUrl,
          },
          lastMessageAt: stats.lastMessageAt.toISOString(),
          myMessageCount: stats.messageCount,
          totalMessageCount: totalCountMap.get(book.id) ?? 0,
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return NextResponse.json({ chatHistory });
  } catch (e) {
    console.error("Chat history GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
