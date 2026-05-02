/**
 * Phase A 検証スクリプト
 *
 * 実行前と実行後にそれぞれ実行し、結果を比較する。
 * - 状態を標準出力に表示
 * - MergeSuggestion 全件を JSON ファイルにダンプ
 * - ReadingStatus 全件をダンプ
 *
 * 使い方:
 *   npx tsx scripts/verify-phase-a.ts --label pre   # 実行前
 *   npx tsx scripts/verify-phase-a.ts --label post  # 実行後
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function getLabel(): string {
  const idx = process.argv.indexOf("--label");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return "snapshot";
}

async function main() {
  const label = getLabel();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupsDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  console.log(`=== Phase A 検証: ${label} (${timestamp}) ===`);
  console.log();

  // 1. 重複グループ数と余剰 Work 数
  const dupeStats: Array<{ groups: bigint; excess: bigint }> = await prisma.$queryRaw`
    SELECT
      COUNT(*)::bigint as groups,
      SUM(cnt - 1)::bigint as excess
    FROM (SELECT COUNT(*) as cnt FROM "Work" GROUP BY title, author HAVING COUNT(*) > 1) sub
  `;
  const groups = Number(dupeStats[0]?.groups ?? 0);
  const excess = Number(dupeStats[0]?.excess ?? 0);
  console.log("1. 重複グループ数:", groups);
  console.log("   余剰 Work 数:", excess);

  // 2. 孤児 Work 数
  const orphans: Array<{ c: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as c FROM "Work" w
    WHERE NOT EXISTS (SELECT 1 FROM "Edition" e WHERE e."workId" = w.id)
  `;
  console.log("2. 孤児 Work 数:", Number(orphans[0].c));

  // 3. Work 総数 / Edition 総数
  const [workCount, editionCount] = await Promise.all([
    prisma.work.count(),
    prisma.edition.count(),
  ]);
  console.log("3. Work 総数:", workCount);
  console.log("   Edition 総数:", editionCount);

  // 4. ReadingStatus 全件ダンプ
  const readingStatuses = await prisma.readingStatus.findMany({
    select: {
      id: true,
      userId: true,
      editionId: true,
      workId: true,
      status: true,
      currentPage: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: { id: "asc" },
  });
  console.log("4. ReadingStatus 件数:", readingStatuses.length);
  const rsFile = path.join(backupsDir, `reading-status-${label}-${timestamp}.json`);
  fs.writeFileSync(rsFile, JSON.stringify(readingStatuses, null, 2));
  console.log("   ダンプ先:", rsFile);

  // ReadingStatus 内容を画面にも出力（件数が少ないため）
  for (const rs of readingStatuses) {
    console.log(`   id=${rs.id} userId=${rs.userId} editionId=${rs.editionId} workId=${rs.workId} status=${rs.status} page=${rs.currentPage}`);
  }

  // 5. Book.migratedWorkId 異常値
  const [nullMigrated, failedMigrated] = await Promise.all([
    prisma.book.count({ where: { migratedWorkId: null } }),
    prisma.book.count({ where: { migratedWorkId: "FAILED" } }),
  ]);
  console.log("5. Book.migratedWorkId null:", nullMigrated);
  console.log("   Book.migratedWorkId FAILED:", failedMigrated);

  // 6. MergeSuggestion 全件ダンプ
  const suggestions = await prisma.mergeSuggestion.findMany({
    select: {
      id: true,
      sourceWorkId: true,
      targetWorkId: true,
      score: true,
      status: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });
  const msFile = path.join(backupsDir, `merge-suggestions-${label}-${timestamp}.json`);
  fs.writeFileSync(msFile, JSON.stringify(suggestions, null, 2));
  const msFileSize = fs.statSync(msFile).size;
  console.log("6. MergeSuggestion 件数:", suggestions.length);
  console.log("   ステータス別:",
    "pending=" + suggestions.filter(s => s.status === "pending").length,
    "approved=" + suggestions.filter(s => s.status === "approved").length,
    "rejected=" + suggestions.filter(s => s.status === "rejected").length,
  );
  console.log("   ダンプ先:", msFile, `(${(msFileSize / 1024).toFixed(1)} KB)`);

  console.log();
  console.log("=== 検証完了 ===");
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
