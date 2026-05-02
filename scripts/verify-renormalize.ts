/**
 * 再正規化検証スクリプト (PR-B3)
 *
 * renormalize-works.ts --execute 実行後に、
 * 期待値ダンプと実 DB の値を突合し、不一致を検出する。
 *
 * 使い方:
 *   npx tsx scripts/verify-renormalize.ts backups/renormalize-expected-XXXX.json
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

interface ExpectedRecord {
  workId: string;
  expected: {
    titleNormalized: string;
    authorNormalized: string;
  };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("使い方: npx tsx scripts/verify-renormalize.ts <expected-dump.json>");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error("ファイルが見つかりません: " + filePath);
    process.exit(1);
  }

  const expected: ExpectedRecord[] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  console.log(`=== 再正規化検証 ===`);
  console.log(`期待値ファイル: ${filePath}`);
  console.log(`検証対象: ${expected.length} 件`);
  console.log();

  // Neon ウォームアップ
  await prisma.$queryRaw`SELECT 1`;

  // Work IDs を抽出して実際の値を取得
  const workIds = expected.map((e) => e.workId);
  const BATCH_SIZE = 500;
  let matched = 0;
  let mismatched = 0;
  let notFound = 0;
  const mismatches: Array<{
    workId: string;
    field: string;
    expected: string;
    actual: string;
  }> = [];

  for (let i = 0; i < workIds.length; i += BATCH_SIZE) {
    const batchIds = workIds.slice(i, i + BATCH_SIZE);
    const works = await prisma.work.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, titleNormalized: true, authorNormalized: true },
    });

    const workMap = new Map(works.map((w) => [w.id, w]));

    for (const exp of expected.slice(i, i + BATCH_SIZE)) {
      const actual = workMap.get(exp.workId);
      if (!actual) {
        notFound++;
        continue;
      }

      let ok = true;
      if (actual.titleNormalized !== exp.expected.titleNormalized) {
        ok = false;
        mismatches.push({
          workId: exp.workId,
          field: "titleNormalized",
          expected: exp.expected.titleNormalized,
          actual: actual.titleNormalized,
        });
      }
      if (actual.authorNormalized !== exp.expected.authorNormalized) {
        ok = false;
        mismatches.push({
          workId: exp.workId,
          field: "authorNormalized",
          expected: exp.expected.authorNormalized,
          actual: actual.authorNormalized,
        });
      }

      if (ok) matched++;
      else mismatched++;
    }

    process.stdout.write(`\r  [${Math.min(i + BATCH_SIZE, workIds.length)}/${workIds.length}] 検証中...`);
  }

  console.log();
  console.log();
  console.log("--- 検証結果 ---");
  console.log(`  一致: ${matched} 件`);
  console.log(`  不一致: ${mismatched} 件`);
  console.log(`  Work が見つからない: ${notFound} 件`);
  console.log();

  if (mismatches.length > 0) {
    console.log("--- 不一致の詳細 (最大 20 件) ---");
    for (const m of mismatches.slice(0, 20)) {
      console.log(`  Work ${m.workId.slice(0, 8)}... [${m.field}]`);
      console.log(`    期待: "${m.expected}"`);
      console.log(`    実際: "${m.actual}"`);
    }
    if (mismatches.length > 20) {
      console.log(`  ... 他 ${mismatches.length - 20} 件`);
    }
    console.log();
    console.error("検証失敗: 不一致が検出されました。");
    process.exit(1);
  }

  if (notFound > 0) {
    console.error(`警告: ${notFound} 件の Work が DB に存在しません（削除された可能性）。`);
  }

  // 追加検証: authorNormalized に「訳」が残っていないことを確認
  const translatorLeakCheck: Array<{ count: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count FROM "Work" WHERE "authorNormalized" LIKE '%訳%'
  `;
  const leakCount = Number(translatorLeakCheck[0]?.count ?? 0);
  if (leakCount > 0) {
    console.error(`警告: authorNormalized に「訳」を含む Work が ${leakCount} 件残っています。`);
  } else {
    console.log("追加検証: authorNormalized に「訳」を含む Work = 0 件 ✓");
  }

  // 著名翻訳書の確認
  console.log();
  console.log("--- 著名翻訳書の確認 ---");
  const famousWorks = await prisma.work.findMany({
    where: {
      OR: [
        { title: { contains: "カラマーゾフ" } },
        { title: { contains: "罪と罰" } },
        { title: { contains: "レ・ミゼラブル" } },
        { title: { contains: "老人と海" } },
        { title: { contains: "変身" } },
      ],
    },
    select: { id: true, title: true, author: true, authorNormalized: true },
    take: 20,
  });

  if (famousWorks.length === 0) {
    console.log("  (該当する翻訳書が見つかりませんでした)");
  } else {
    for (const w of famousWorks) {
      console.log(`  "${w.title}" | author: "${w.author}" | normalized: "${w.authorNormalized}"`);
    }
  }

  console.log();
  console.log("=== 検証完了 ===");
}

main()
  .catch((e) => {
    console.error("致命的エラー:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
