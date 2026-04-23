/**
 * custom_rank 計算（Neon無料プラン対応）
 * 全件UPDATEを避け、対象を絞った小さなUPDATEのみ実行
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const S_LABELS = [
  "新潮文庫", "新潮新書", "講談社文庫", "講談社現代新書", "講談社学術文庫",
  "文春文庫", "文春新書", "角川文庫", "角川新書", "角川ソフィア文庫",
  "集英社文庫", "集英社新書", "小学館文庫",
  "岩波文庫", "岩波新書", "岩波現代文庫", "岩波少年文庫",
  "河出文庫", "ちくま文庫", "ちくま新書", "ちくま学芸文庫",
  "光文社文庫", "光文社古典新訳文庫", "光文社新書",
  "中公文庫", "中公新書",
  "ハヤカワ文庫SF", "ハヤカワ文庫JA", "ハヤカワ文庫NV",
  "創元推理文庫", "創元SF文庫",
  "幻冬舎文庫", "幻冬舎新書", "徳間文庫", "双葉文庫",
  "朝日文庫", "扶桑社文庫", "PHP新書", "PHP文庫", "ブルーバックス",
  "平凡社ライブラリー", "SB新書", "宝島社文庫", "ポプラ文庫",
];

const A_PUBLISHERS = [
  "新潮社", "講談社", "文藝春秋", "文芸春秋", "KADOKAWA", "角川書店",
  "集英社", "小学館", "岩波書店", "河出書房新社", "筑摩書房",
  "光文社", "中央公論新社", "早川書房", "白水社", "みすず書房",
  "東京創元社", "幻冬舎", "ダイヤモンド社", "東洋経済新報社", "日経BP",
  "朝日新聞出版", "NHK出版", "平凡社", "静山社",
  "徳間書店", "双葉社", "PHP研究所", "扶桑社", "宝島社", "ポプラ社",
  "祥伝社", "青土社", "作品社",
];

async function safeExec(sql: string, params: string[] = []): Promise<number> {
  try {
    return await prisma.$executeRawUnsafe(sql, ...params);
  } catch (e) {
    console.log(`    (skipped: ${(e as Error).message?.slice(0, 60)})`);
    return 0;
  }
}

async function main() {
  console.log("=== custom_rank 計算 ===\n");

  // S層レーベル
  console.log("[1/3] S-tier labels...");
  let sCount = 0;
  for (const label of S_LABELS) {
    const n = await safeExec(
      `UPDATE "Book" SET "publisherTier" = 'S', "publisherScore" = 50, "customRank" = 50 + "completenessScore" WHERE ("label" ILIKE $1 OR "labelNormalized" ILIKE $1 OR "seriesName" ILIKE $1 OR "title" ILIKE $1)`,
      [`%${label}%`]
    );
    sCount += n;
  }
  console.log(`  S-tier: ${sCount.toLocaleString()} books`);

  // A層出版社（S層以外）
  console.log("[2/3] A-tier publishers...");
  let aCount = 0;
  for (const pub of A_PUBLISHERS) {
    const n = await safeExec(
      `UPDATE "Book" SET "publisherTier" = 'A', "publisherScore" = 30, "customRank" = 30 + "completenessScore" WHERE "publisherTier" != 'S' AND ("publisher" ILIKE $1 OR "publisherNormalized" ILIKE $1)`,
      [`%${pub}%`]
    );
    aCount += n;
  }
  console.log(`  A-tier: ${aCount.toLocaleString()} books`);

  // C層のcustom_rankをcompleteness_scoreに
  console.log("[3/3] C-tier custom_rank = completenessScore...");
  // 小分けに実行
  for (let i = 0; i < 20; i++) {
    const n = await safeExec(
      `UPDATE "Book" SET "customRank" = "completenessScore" WHERE "publisherTier" NOT IN ('S', 'A') AND "customRank" = 0 AND "id" IN (SELECT "id" FROM "Book" WHERE "publisherTier" NOT IN ('S', 'A') AND "customRank" = 0 LIMIT 50000)`
    );
    if (n === 0) break;
    console.log(`  Batch ${i + 1}: ${n.toLocaleString()}`);
  }

  // Top 10
  console.log("\n=== Top 10 ===");
  try {
    const top = await prisma.book.findMany({
      select: { title: true, author: true, publisher: true, label: true, customRank: true, publisherTier: true, totalPages: true },
      orderBy: { customRank: "desc" },
      take: 10,
    });
    for (const b of top) {
      console.log(`  [${b.publisherTier}|${b.customRank}] ${b.title} / ${b.author} (${b.publisher || "?"}) ${b.totalPages}p`);
    }
  } catch { console.log("  (query skipped)"); }

  await prisma.$disconnect();
  console.log("\nDone!");
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
