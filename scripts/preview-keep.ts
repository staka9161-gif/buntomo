/**
 * 全重複ペアの統合プレビュー（一括取得版）
 *
 * DB への変更は一切行わない。
 *
 * 使い方:
 *   npx tsx scripts/preview-keep.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface WorkInfo {
  id: string;
  title: string;
  author: string;
  createdAt: Date;
  editionCount: number;
  isbnCount: number;
}

function decideKeep(a: WorkInfo, b: WorkInfo): { keep: WorkInfo; remove: WorkInfo; reason: string } {
  if (a.isbnCount !== b.isbnCount) {
    return a.isbnCount > b.isbnCount
      ? { keep: a, remove: b, reason: "isbn_count" }
      : { keep: b, remove: a, reason: "isbn_count" };
  }
  if (a.editionCount !== b.editionCount) {
    return a.editionCount > b.editionCount
      ? { keep: a, remove: b, reason: "edition_count" }
      : { keep: b, remove: a, reason: "edition_count" };
  }
  if (a.createdAt.getTime() !== b.createdAt.getTime()) {
    return a.createdAt < b.createdAt
      ? { keep: a, remove: b, reason: "created_at" }
      : { keep: b, remove: a, reason: "created_at" };
  }
  return { keep: a, remove: b, reason: "tie" };
}

async function main() {
  console.log("全 Work と Edition を一括取得中...");

  // 全 Work を一括取得（Edition は集計のみ）
  const allWorks: Array<{
    id: string; title: string; author: string; createdAt: Date;
  }> = await prisma.work.findMany({
    select: { id: true, title: true, author: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Edition の isbn13 有無を Work ごとに集計
  const editionStats: Array<{ workId: string; total: bigint; withIsbn: bigint }> = await prisma.$queryRaw`
    SELECT "workId",
           COUNT(*)::bigint as total,
           COUNT(isbn13)::bigint as "withIsbn"
    FROM "Edition"
    GROUP BY "workId"
  `;
  const editionMap = new Map<string, { total: number; withIsbn: number }>();
  for (const row of editionStats) {
    editionMap.set(row.workId, { total: Number(row.total), withIsbn: Number(row.withIsbn) });
  }

  // MergeSuggestion を全件取得
  const allSuggestions = await prisma.mergeSuggestion.findMany({
    select: { id: true, sourceWorkId: true, targetWorkId: true },
  });
  const sugBySource = new Map<string, typeof allSuggestions>();
  const sugByTarget = new Map<string, typeof allSuggestions>();
  for (const s of allSuggestions) {
    if (!sugBySource.has(s.sourceWorkId)) sugBySource.set(s.sourceWorkId, []);
    sugBySource.get(s.sourceWorkId)!.push(s);
    if (!sugByTarget.has(s.targetWorkId)) sugByTarget.set(s.targetWorkId, []);
    sugByTarget.get(s.targetWorkId)!.push(s);
  }

  console.log(`Work 数: ${allWorks.length}, MergeSuggestion 数: ${allSuggestions.length}`);

  // title+author でグルーピング
  const groups = new Map<string, WorkInfo[]>();
  for (const w of allWorks) {
    const key = `${w.title}\0${w.author}`;
    if (!groups.has(key)) groups.set(key, []);
    const stats = editionMap.get(w.id) || { total: 0, withIsbn: 0 };
    groups.get(key)!.push({
      id: w.id,
      title: w.title,
      author: w.author,
      createdAt: w.createdAt,
      editionCount: stats.total,
      isbnCount: stats.withIsbn,
    });
  }

  // 重複グループのみ
  const dupeGroups = [...groups.values()].filter(g => g.length > 1);
  const totalPairs = dupeGroups.reduce((s, g) => s + g.length - 1, 0);

  console.log(`重複グループ数: ${dupeGroups.length}`);
  console.log(`余剰 Work (統合対象) 数: ${totalPairs}`);

  // 集計変数
  const reasonCounts: Record<string, number> = { isbn_count: 0, edition_count: 0, created_at: 0, tie: 0 };
  let bothHaveIsbn = 0;
  let bothZeroEditions = 0;
  let selfRefDeletes = 0;
  let dupeDeletes = 0;
  let simpleTransfers = 0;
  let maxOpsPerPair = 0;
  let totalOps = 0;

  for (const group of dupeGroups) {
    // keeper を決定
    let keeper = group[0];
    for (let k = 1; k < group.length; k++) {
      const d = decideKeep(keeper, group[k]);
      keeper = d.keep;
    }

    const removals = group.filter(w => w.id !== keeper.id);

    for (const removeWork of removals) {
      const decision = decideKeep(keeper, removeWork);
      reasonCounts[decision.reason]++;

      if (keeper.isbnCount > 0 && removeWork.isbnCount > 0) bothHaveIsbn++;
      if (keeper.editionCount === 0 && removeWork.editionCount === 0) bothZeroEditions++;

      // MergeSuggestion 操作シミュレーション
      let pairOps = 0;
      const keepId = keeper.id;
      const removeId = removeWork.id;

      // パターン 1+2: 自己参照
      const sr1 = (sugBySource.get(removeId) || []).filter(s => s.targetWorkId === keepId).length;
      const sr2 = (sugBySource.get(keepId) || []).filter(s => s.targetWorkId === removeId).length;
      selfRefDeletes += sr1 + sr2;
      pairOps += sr1 + sr2;

      // パターン 3: removeWork が source、target != keeper
      const otherSource = (sugBySource.get(removeId) || []).filter(s => s.targetWorkId !== keepId);
      for (const s of otherSource) {
        const exists = (sugBySource.get(keepId) || []).some(ex => ex.targetWorkId === s.targetWorkId);
        if (exists) dupeDeletes++;
        else simpleTransfers++;
        pairOps++;
      }

      // パターン 4: removeWork が target、source != keeper
      const otherTarget = (sugByTarget.get(removeId) || []).filter(s => s.sourceWorkId !== keepId);
      for (const s of otherTarget) {
        const exists = (sugByTarget.get(keepId) || []).some(ex => ex.sourceWorkId === s.sourceWorkId);
        if (exists) dupeDeletes++;
        else simpleTransfers++;
        pairOps++;
      }

      totalOps += pairOps;
      if (pairOps > maxOpsPerPair) maxOpsPerPair = pairOps;
    }
  }

  // 出力
  console.log();
  console.log("--- 全 " + totalPairs + " ペアの決着内訳 ---");
  console.log("ISBN付きEdition数で決着:", reasonCounts.isbn_count, "件");
  console.log("Edition数で決着:", reasonCounts.edition_count, "件");
  console.log("createdAtで決着:", reasonCounts.created_at, "件");
  console.log("全項目同点(元の順序維持):", reasonCounts.tie, "件");

  console.log();
  console.log("--- ISBN消失リスク ---");
  console.log("両方ともISBN付きEditionを持つペア数:", bothHaveIsbn, "件");
  console.log("→ Edition.isbn13 は Edition レコードごと keeper に移動するため消失しない");

  console.log();
  console.log("--- 異常検出 ---");
  console.log("両方とも Edition 0 件のペア(孤児ペア):", bothZeroEditions, "件");
  if (bothZeroEditions > 0) {
    console.log("⚠ 異常検出: 自動統合を中止してください。原因調査が必要です。");
  }

  console.log();
  console.log("--- MergeSuggestion 付け替え統計 ---");
  console.log("自己参照削除 (パターン1+2):", selfRefDeletes, "件");
  console.log("重複削除 (パターン3+4 で既存ペアあり):", dupeDeletes, "件");
  console.log("単純付け替え (パターン3+4 で既存ペアなし):", simpleTransfers, "件");
  console.log("1 ペアあたりの最大操作数:", maxOpsPerPair, "件");
  console.log("1 ペアあたりの平均操作数:", totalPairs > 0 ? (totalOps / totalPairs).toFixed(1) : "0", "件");

  if (maxOpsPerPair > 50) {
    console.log("⚠ MergeSuggestion 操作が 50 件超のペアがあります。");
    console.log("  該当ペアは自動統合をスキップして MergeSuggestion 行きにすべきです。");
  }
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
