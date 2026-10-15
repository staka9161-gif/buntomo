import { NextRequest, NextResponse } from "next/server";
import { normalizeLookupIsbn } from "@/lib/isbn";
import { lookupIsbn } from "@/lib/isbn-lookup";

export async function GET(request: NextRequest) {
  const isbn = normalizeLookupIsbn(request.nextUrl.searchParams.get("isbn"));
  if (!isbn) {
    return NextResponse.json({ error: "有効なISBN（10桁または13桁）を入力してください。" }, { status: 400 });
  }
  try {
    const { book, unavailable } = await lookupIsbn(isbn);
    if (!book && unavailable) {
      return NextResponse.json({ error: "書誌情報を取得できませんでした。時間をおいて再度お試しください。" }, { status: 503 });
    }
    return NextResponse.json({ books: book ? [book] : [], meta: { isbn, total: book ? 1 : 0 } });
  } catch {
    return NextResponse.json({ error: "ISBN検索に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
  }
}
