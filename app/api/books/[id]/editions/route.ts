import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeText, katakanaToHiragana, removeSymbols } from "@/lib/normalize";

// 同タイトル・関連版の書籍を返す
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) {
      return NextResponse.json({ error: "本が見つかりません" }, { status: 404 });
    }

    // タイトルを正規化して基本部分を抽出
    // 「ノルウェイの森 上」→「ノルウェイの森」のように巻数表記を除去
    const baseTitle = extractBaseTitle(book.title);

    // 同タイトルの書籍をDBから検索
    const candidates = await prisma.book.findMany({
      where: {
        id: { not: id },
        title: { contains: baseTitle },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    // 正規化タイトルでフィルタリング（ノイズ除去）
    const normalizedBase = removeSymbols(normalizeText(baseTitle)).toLowerCase();
    const normalizedBaseH = katakanaToHiragana(normalizedBase);

    const editions = candidates.filter((c) => {
      const cBase = removeSymbols(normalizeText(extractBaseTitle(c.title))).toLowerCase();
      const cBaseH = katakanaToHiragana(cBase);
      // 基本タイトル同士が完全一致
      if (cBase === normalizedBase || cBaseH === normalizedBaseH) return true;
      // 候補が元タイトルで始まる or 元タイトルが候補で始まる（先頭一致）
      if (cBase.startsWith(normalizedBase) || cBaseH.startsWith(normalizedBaseH)) return true;
      if (normalizedBase.startsWith(cBase) || normalizedBaseH.startsWith(cBaseH)) return true;
      return false;
    });

    return NextResponse.json({
      editions: editions.map((e) => ({
        id: e.id,
        isbn: e.isbn,
        title: e.title,
        author: e.author,
        coverImageUrl: e.coverImageUrl,
      })),
    });
  } catch (e) {
    console.error("Editions GET error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// タイトルから巻数・版表記を除去して基本タイトルを抽出
function extractBaseTitle(title: string): string {
  let t = title;
  // 末尾の巻数表記を除去: 「上」「下」「(上)」「（下）」「1」「第1巻」etc.
  t = t.replace(/[\s　]*[\(（【\[]?(?:上|下|[上下]巻|第?\d+[巻号冊部編]?|[ⅠⅡⅢⅣⅤ]|[①②③④⑤⑥⑦⑧⑨⑩])[\)）】\]]?\s*$/, "");
  // 末尾の版表記: 「新装版」「文庫版」「改訂版」etc.
  t = t.replace(/[\s　]*(?:新装版|文庫版|改訂版|増補版|完全版|愛蔵版|新版|復刊版|ワイド版)\s*$/, "");
  return t.trim();
}
