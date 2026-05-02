/**
 * バッチマッチングスクリプト（Phase A 修正版）
 *
 * 全 Work を正規化タイトル+著者でグルーピングし、
 * 同一グループ内でマッチングスコアを計算。
 * - score ≥ 0.92: 自動統合（--execute 時のみ）
 * - 0.75 ≤ score < 0.92: MergeSuggestion 作成
 *
 * 保険チェック:
 * - ページ数 ±50% 超 → MergeSuggestion に降格
 * - 出版年 10年超 → MergeSuggestion に降格
 * - MergeSuggestion 操作 50件超のペア → MergeSuggestion に降格
 *
 * 使い方:
 *   npx tsx scripts/batch-matching.ts              # dry-run
 *   npx tsx scripts/batch-matching.ts --execute     # 本実行（インタラクティブ確認あり）
 */

import { PrismaClient } from "@prisma/client";
import { normalizeTitle, normalizeAuthor } from "../lib/normalize-work";
import { calculateMatchScore, classifyMatch, MATCH_THRESHOLDS } from "../lib/matching";
import type { BookCandidate } from "../lib/matching";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes("--execute");
const CONSERVATIVE_MODE = process.argv.includes("--conservative-mode");
const TIMEOUT_MS = (() => {
  const idx = process.argv.indexOf("--timeout-ms");
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 30000;
})();

// ============================================================
// ロックファイル
// ============================================================
const LOCK_FILE = path.join(__dirname, ".batch-matching.lock");

function acquireLock(): void {
  if (fs.existsSync(LOCK_FILE)) {
    let info = "";
    try {
      info = fs.readFileSync(LOCK_FILE, "utf8");
    } catch {}
    console.error("エラー: ロックファイルが存在します: " + LOCK_FILE);
    console.error("内容: " + info);
    console.error("別のバッチマッチングが実行中か、前回の実行が異常終了した可能性があります。");
    console.error("確認の上、手動で削除してから再実行してください。");
    process.exit(1);
  }
  const lockContent = JSON.stringify({
    user: os.userInfo().username,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  });
  fs.writeFileSync(LOCK_FILE, lockContent);
}

function releaseLock(): void {
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

// シグナルハンドラ: 異常終了時もロックファイルを削除
process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(130); });
process.on("SIGTERM", () => { releaseLock(); process.exit(143); });
process.on("uncaughtException", (e) => {
  console.error("uncaughtException:", e);
  releaseLock();
  process.exit(1);
});

// ============================================================
// インタラクティブ確認（--execute 時のみ）
// ============================================================
async function confirmExecution(): Promise<void> {
  if (DRY_RUN) return;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(
      "本実行モードです。\n" +
      "Neon スナップショットまたは pg_dump バックアップを取得しましたか？\n" +
      "  取得日時を入力 (例: 2026-05-01 12:00)\n" +
      "  または「バックアップなしで進める」と入力: ",
      resolve
    );
  });
  rl.close();

  const trimmed = answer.trim();
  if (!trimmed) {
    console.log("入力がないため中止します。");
    process.exit(0);
  }
  if (trimmed === "バックアップなしで進める") {
    console.log("バックアップなしで続行します。");
  } else {
    console.log(`バックアップ取得日時: ${trimmed}`);
  }
  console.log();
}

// ============================================================
// 型定義
// ============================================================
interface WorkRecord {
  id: string;
  title: string;
  titleNormalized: string;
  author: string;
  authorNormalized: string;
  originalTitle: string | null;
  ndlWorkId: string | null;
  openlibraryWorkId: string | null;
  createdAt: Date;
  editions: Array<{
    isbn13: string | null;
    publisher: string | null;
    format: string;
    pageCount: number | null;
    publishedAt: Date | null;
    titleOnCover: string;
  }>;
}

// ============================================================
// Work → BookCandidate 変換
// ============================================================
function toCandidate(work: WorkRecord): BookCandidate {
  const edition = work.editions[0];
  return {
    title: work.title,
    titleNormalized: work.titleNormalized || undefined,
    author: work.author,
    authorNormalized: work.authorNormalized || undefined,
    publisher: edition?.publisher || undefined,
    year: edition?.publishedAt ? new Date(edition.publishedAt).getFullYear() : undefined,
    pageCount: edition?.pageCount || undefined,
    format: edition?.format || undefined,
    isbn: edition?.isbn13 || undefined,
    originalTitle: work.originalTitle || undefined,
    ndlWorkId: work.ndlWorkId || undefined,
    openlibraryWorkId: work.openlibraryWorkId || undefined,
  };
}

// ============================================================
// 残す Work の決定
// ============================================================
function decideKeep(a: WorkRecord, b: WorkRecord): [WorkRecord, WorkRecord] {
  // a. ISBN13 が埋まっている Edition 数
  const isbnA = a.editions.filter(e => e.isbn13 != null).length;
  const isbnB = b.editions.filter(e => e.isbn13 != null).length;
  if (isbnA !== isbnB) return isbnA > isbnB ? [a, b] : [b, a];

  // b. Edition 数
  if (a.editions.length !== b.editions.length) {
    return a.editions.length > b.editions.length ? [a, b] : [b, a];
  }

  // c. createdAt が古い方を残す
  if (a.createdAt < b.createdAt) return [a, b];
  if (a.createdAt > b.createdAt) return [b, a];

  return [a, b];
}

// ============================================================
// バケットキー
// ============================================================
function bucketKey(work: WorkRecord): string {
  const titlePrefix = (work.titleNormalized || normalizeTitle(work.title).normalized).slice(0, 6);
  const authorNorm = work.authorNormalized || normalizeAuthor(work.author);
  return `${titlePrefix}|${authorNorm}`;
}

// ============================================================
// MergeSuggestion 操作数の事前カウント（保険用）
// ============================================================
async function countMergeSuggestionOps(
  keepId: string,
  removeId: string
): Promise<number> {
  const [asSource, asTarget] = await Promise.all([
    prisma.mergeSuggestion.count({ where: { sourceWorkId: removeId } }),
    prisma.mergeSuggestion.count({ where: { targetWorkId: removeId } }),
  ]);
  return asSource + asTarget;
}

// ============================================================
// MergeSuggestion の付け替え処理（トランザクション内で実行）
// ============================================================
async function transferMergeSuggestions(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  keepId: string,
  removeId: string
): Promise<void> {
  // パターン 1: removeWork が source、keeper が target → 自己参照になるので削除
  await tx.mergeSuggestion.deleteMany({
    where: { sourceWorkId: removeId, targetWorkId: keepId },
  });
  // パターン 2: keeper が source、removeWork が target → 自己参照になるので削除
  await tx.mergeSuggestion.deleteMany({
    where: { sourceWorkId: keepId, targetWorkId: removeId },
  });

  // パターン 3: removeWork が source、target が keeper 以外 → 付け替え or 重複削除
  const sourceSuggestions = await tx.mergeSuggestion.findMany({
    where: { sourceWorkId: removeId },
    select: { id: true, targetWorkId: true },
  });
  for (const s of sourceSuggestions) {
    const existing = await tx.mergeSuggestion.findFirst({
      where: { sourceWorkId: keepId, targetWorkId: s.targetWorkId },
    });
    if (existing) {
      await tx.mergeSuggestion.delete({ where: { id: s.id } });
    } else {
      await tx.mergeSuggestion.update({
        where: { id: s.id },
        data: { sourceWorkId: keepId },
      });
    }
  }

  // パターン 4: removeWork が target、source が keeper 以外 → 付け替え or 重複削除
  const targetSuggestions = await tx.mergeSuggestion.findMany({
    where: { targetWorkId: removeId },
    select: { id: true, sourceWorkId: true },
  });
  for (const s of targetSuggestions) {
    const existing = await tx.mergeSuggestion.findFirst({
      where: { sourceWorkId: s.sourceWorkId, targetWorkId: keepId },
    });
    if (existing) {
      await tx.mergeSuggestion.delete({ where: { id: s.id } });
    } else {
      await tx.mergeSuggestion.update({
        where: { id: s.id },
        data: { targetWorkId: keepId },
      });
    }
  }
}

// ============================================================
// メイン処理
// ============================================================
async function main() {
  acquireLock();
  await confirmExecution();

  console.log(DRY_RUN ? "=== DRY RUN モード ===" : "=== 実行モード ===");
  console.log();

  // 全 Work を取得（全 Edition 含む — decideKeep で ISBN カウントに必要）
  const works = await prisma.work.findMany({
    include: {
      editions: {
        select: {
          isbn13: true,
          publisher: true,
          format: true,
          pageCount: true,
          publishedAt: true,
          titleOnCover: true,
        },
      },
    },
    orderBy: { titleNormalized: "asc" },
  });

  console.log(`全 Work 数: ${works.length}`);

  // バケット分け
  const buckets = new Map<string, WorkRecord[]>();
  for (const work of works) {
    const key = bucketKey(work);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(work);
  }

  const candidateBuckets = [...buckets.entries()].filter(([, v]) => v.length >= 2);
  console.log(`候補バケット数: ${candidateBuckets.length} (2件以上のグループ)`);
  console.log();

  // 集計変数
  let autoMergeCount = 0;
  let suggestMergeCount = 0;
  let separateCount = 0;
  let errorCount = 0;
  let pairsChecked = 0;
  let insurancePageCount = 0;
  let insuranceYear = 0;
  let insuranceMsOps = 0;
  let insuranceConservative = 0;

  // スコア分布
  const scoreBuckets = { ge092: 0, ge085: 0, ge075: 0, lt075: 0 };

  // 既存 MergeSuggestion ペアを取得
  const existingSuggestions = await prisma.mergeSuggestion.findMany({
    where: { status: "pending" },
    select: { sourceWorkId: true, targetWorkId: true },
  });
  const existingPairs = new Set(
    existingSuggestions.flatMap((s) => [
      `${s.sourceWorkId}|${s.targetWorkId}`,
      `${s.targetWorkId}|${s.sourceWorkId}`,
    ])
  );

  const mergedWorkIds = new Set<string>();

  for (const [, bucket] of candidateBuckets) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const rawA = bucket[i];
        const rawB = bucket[j];

        if (mergedWorkIds.has(rawA.id) || mergedWorkIds.has(rawB.id)) continue;

        pairsChecked++;

        try {
          const candidateA = toCandidate(rawA);
          const candidateB = toCandidate(rawB);
          const result = classifyMatch(candidateA, candidateB);

          // スコア分布集計
          if (result.score >= 0.92) scoreBuckets.ge092++;
          else if (result.score >= 0.85) scoreBuckets.ge085++;
          else if (result.score >= 0.75) scoreBuckets.ge075++;
          else scoreBuckets.lt075++;

          if (result.classification === "auto_merge") {
            // 保険チェック: ページ数 ±50% 超
            const pageA = candidateA.pageCount;
            const pageB = candidateB.pageCount;
            if (pageA && pageB && pageA > 0 && pageB > 0) {
              const ratio = Math.min(pageA, pageB) / Math.max(pageA, pageB);
              if (ratio < 0.5) {
                result.classification = "suggest_merge";
                result.reason = "保険: ページ数差 ±50% 超";
                insurancePageCount++;
              }
            }

            // 保険チェック: 出版年 10年超
            if (result.classification === "auto_merge") {
              const yearA = candidateA.year;
              const yearB = candidateB.year;
              if (yearA && yearB && Math.abs(yearA - yearB) > 10) {
                result.classification = "suggest_merge";
                result.reason = "保険: 出版年差 10年超";
                insuranceYear++;
              }
            }

            // 保険チェック: MergeSuggestion 操作 50件超
            if (result.classification === "auto_merge" && !DRY_RUN) {
              const msOps = await countMergeSuggestionOps(rawA.id, rawB.id);
              if (msOps > 50) {
                result.classification = "suggest_merge";
                result.reason = "保険: MergeSuggestion 操作 " + msOps + " 件超";
                insuranceMsOps++;
              }
            }
          }

          // conservative-mode: title+author 完全一致でないペアは降格
          if (result.classification === "auto_merge" && CONSERVATIVE_MODE) {
            if (rawA.title !== rawB.title || rawA.author !== rawB.author) {
              result.classification = "suggest_merge";
              result.reason = "conservative-mode: title+author 不一致";
              insuranceConservative++;
            }
          }

          if (result.classification === "auto_merge") {
            // decideKeep で残す Work を決定
            const [keep, remove] = decideKeep(rawA, rawB);
            autoMergeCount++;
            console.log(`  [AUTO] keep="${keep.title}" (${keep.id.slice(-8)}) remove="${remove.title}" (${remove.id.slice(-8)}) score=${result.score.toFixed(3)}`);

            if (!DRY_RUN) {
              await prisma.$transaction(async (tx) => {
                await tx.edition.updateMany({
                  where: { workId: remove.id },
                  data: { workId: keep.id },
                });
                await tx.translationGroup.updateMany({
                  where: { workId: remove.id },
                  data: { workId: keep.id },
                });
                await tx.readingStatus.updateMany({
                  where: { workId: remove.id },
                  data: { workId: keep.id },
                });
                // Review: 重複ユーザーは先勝ち
                const existingReviewers = await tx.review.findMany({
                  where: { workId: keep.id },
                  select: { userId: true },
                });
                const existingIds = new Set(existingReviewers.map((r) => r.userId));
                if (existingIds.size > 0) {
                  await tx.review.deleteMany({
                    where: { workId: remove.id, userId: { in: [...existingIds] } },
                  });
                }
                await tx.review.updateMany({
                  where: { workId: remove.id },
                  data: { workId: keep.id },
                });
                await tx.chatMessage.updateMany({
                  where: { workId: remove.id },
                  data: { workId: keep.id },
                });
                await tx.readingEvent.updateMany({
                  where: { workId: remove.id },
                  data: { workId: keep.id },
                });

                // MergeSuggestion の付け替え・削除
                await transferMergeSuggestions(tx, keep.id, remove.id);

                await tx.work.delete({ where: { id: remove.id } });
              }, { timeout: TIMEOUT_MS });

              mergedWorkIds.add(remove.id);
            }
          } else if (result.classification === "suggest_merge") {
            const pairKey = `${rawA.id}|${rawB.id}`;
            if (existingPairs.has(pairKey)) continue;

            suggestMergeCount++;
            console.log(`  [SUGGEST] "${rawA.title}" + "${rawB.title}" score=${result.score.toFixed(3)} reason=${result.reason}`);

            if (!DRY_RUN) {
              await prisma.mergeSuggestion.create({
                data: {
                  sourceWorkId: rawA.id,
                  targetWorkId: rawB.id,
                  score: result.score,
                  reason: `バッチマッチング: ${result.reason}`,
                  status: "pending",
                },
              });
              existingPairs.add(pairKey);
              existingPairs.add(`${rawB.id}|${rawA.id}`);
            }
          } else {
            separateCount++;
          }
        } catch (e) {
          errorCount++;
          console.error(`  [ERROR] "${rawA.title}" + "${rawB.title}": ${e}`);
        }
      }
    }
  }

  // 結果サマリ
  console.log();
  console.log("=== 結果サマリ ===");
  console.log(`ペア比較数: ${pairsChecked}`);
  console.log(`自動統合${DRY_RUN ? "予定" : ""}: ${autoMergeCount}`);
  console.log(`MergeSuggestion${DRY_RUN ? " 行き予定" : ""}: ${suggestMergeCount}`);
  console.log(`別作品: ${separateCount}`);
  console.log(`エラー: ${errorCount}`);

  console.log();
  console.log("=== スコア分布 ===");
  console.log(`score >= 0.92: ${scoreBuckets.ge092} 件`);
  console.log(`0.85 <= score < 0.92: ${scoreBuckets.ge085} 件`);
  console.log(`0.75 <= score < 0.85: ${scoreBuckets.ge075} 件`);
  console.log(`score < 0.75: ${scoreBuckets.lt075} 件`);

  console.log();
  console.log("=== 保険発動 ===");
  console.log(`ページ数差 ±50% 超で降格: ${insurancePageCount} 件`);
  console.log(`出版年差 10年超で降格: ${insuranceYear} 件`);
  console.log(`MergeSuggestion 操作 50件超で降格: ${insuranceMsOps} 件`);
  console.log(`conservative-mode で降格: ${insuranceConservative} 件`);

  if (DRY_RUN) {
    console.log();
    console.log("※ dry-run です。実行するには --execute を付けてください。");
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
