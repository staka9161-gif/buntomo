import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { isbn, title, author, totalPages, coverImageUrl, description } =
      await request.json();

    if (!title || !author) {
      return NextResponse.json({ error: "タイトルと著者は必須です" }, { status: 400 });
    }

    // ISBN があれば既存チェック（冪等）
    if (isbn) {
      const existing = await prisma.book.findUnique({ where: { isbn } });
      if (existing) {
        return NextResponse.json({ book: existing });
      }
    }

    const book = await prisma.book.create({
      data: {
        isbn: isbn || null,
        title,
        author,
        totalPages: totalPages || 0,
        coverImageUrl: coverImageUrl || null,
        description: description || null,
      },
    });

    return NextResponse.json({ book }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
