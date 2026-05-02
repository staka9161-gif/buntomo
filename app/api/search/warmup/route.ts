import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { metaSearch } from "@/lib/search/meta-search";

// 事前ウォームアップ：人気クエリのキャッシュを事前に温める
// Vercel Cronや外部トリガーから呼び出す
// GET /api/search/warmup?secret=xxx

const PRESET_QUERIES = [
  // 芥川賞・直木賞・本屋大賞の定番
  "ノルウェイの森", "カラマーゾフの兄弟", "東京都同情塔",
  "リーダブルコード", "人間失格", "コンビニ人間",
  "火花", "推し、燃ゆ", "流浪の月", "52ヘルツのクジラたち",
  "村上春樹", "東野圭吾", "湊かなえ", "伊坂幸太郎",
  "1Q84", "容疑者Xの献身", "告白", "重力ピエロ",
  "君の膵臓をたべたい", "夜は短し歩けよ乙女",
  "三体", "プロジェクト・ヘイル・メアリー",
  "同志少女よ、敵を撃て", "成瀬は天下を取りにいく",
  "正欲", "汝、星のごとく",
];

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 直近の人気検索クエリをDB学習シグナルから取得
  let dynamicQueries: string[] = [];
  try {
    const popular = await prisma.learningSignal.groupBy({
      by: ["queryNormalized"],
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
      take: 50,
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    dynamicQueries = popular.map((p) => p.queryNormalized);
  } catch {
    // 学習シグナルがない場合は無視
  }

  const allQueries = [...new Set([...PRESET_QUERIES, ...dynamicQueries])];
  const results: { query: string; count: number; ms: number }[] = [];

  // 順番に実行（API負荷を避けるため直列）
  for (const query of allQueries) {
    try {
      const res = await metaSearch(query);
      results.push({ query, count: res.books.length, ms: res.meta.tookMs });
    } catch {
      results.push({ query, count: 0, ms: 0 });
    }
  }

  return NextResponse.json({
    warmed: results.length,
    results,
  });
}
