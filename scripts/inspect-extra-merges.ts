/**
 * dry-run で auto_merge 判定されたが title+author 完全一致ではないペアを
 * 全件抽出して詳細を出力する。
 *
 * 使い方:
 *   npx tsx scripts/inspect-extra-merges.ts
 */

import { PrismaClient } from "@prisma/client";
import { normalizeTitle, normalizeAuthor } from "../lib/normalize-work";
import { calculateMatchScore, classifyMatch } from "../lib/matching";
import type { BookCandidate } from "../lib/matching";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

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

function toCandidate(work: WorkRecord): BookCandidate {
  const edition = work.editions[0];
  return {
    title: work.title,
    author: work.author,
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

function bucketKey(work: WorkRecord): string {
  const titlePrefix = (work.titleNormalized || normalizeTitle(work.title).normalized).slice(0, 6);
  const authorNorm = work.authorNormalized || normalizeAuthor(work.author);
  return `${titlePrefix}|${authorNorm}`;
}

function decideKeep(a: WorkRecord, b: WorkRecord): { keep: WorkRecord; remove: WorkRecord; reason: string } {
  const isbnA = a.editions.filter(e => e.isbn13 != null).length;
  const isbnB = b.editions.filter(e => e.isbn13 != null).length;
  if (isbnA !== isbnB) return isbnA > isbnB ? { keep: a, remove: b, reason: "isbn_count" } : { keep: b, remove: a, reason: "isbn_count" };
  if (a.editions.length !== b.editions.length) return a.editions.length > b.editions.length ? { keep: a, remove: b, reason: "edition_count" } : { keep: b, remove: a, reason: "edition_count" };
  if (a.createdAt < b.createdAt) return { keep: a, remove: b, reason: "created_at" };
  if (a.createdAt > b.createdAt) return { keep: b, remove: a, reason: "created_at" };
  return { keep: a, remove: b, reason: "tie" };
}

// スコア内訳を取得するためのヘルパー（matching.ts の内部ロジックを再現）
function scoreBreakdown(a: BookCandidate, b: BookCandidate): string {
  const normA = normalizeTitle(a.title, undefined);
  const normB = normalizeTitle(b.title, undefined);
  const authorA = normalizeAuthor(a.author, undefined);
  const authorB = normalizeAuthor(b.author, undefined);
  const authorMatch = authorA === authorB;

  const parts: string[] = [];
  parts.push(`titleNormA="${normA.normalized}" titleNormB="${normB.normalized}"`);
  parts.push(`authorNormA="${authorA}" authorNormB="${authorB}" authorMatch=${authorMatch}`);
  parts.push(`volumeA=${normA.volume ?? "null"} volumeB=${normB.volume ?? "null"}`);

  if (a.year && b.year) parts.push(`yearDiff=${Math.abs(a.year - b.year)}`);
  if (a.pageCount && b.pageCount) {
    const ratio = Math.min(a.pageCount, b.pageCount) / Math.max(a.pageCount, b.pageCount);
    parts.push(`pageRatio=${ratio.toFixed(2)}`);
  }

  return parts.join(" | ");
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(__dirname, "..", "backups", `extra-merges-${timestamp}.txt`);

  console.log("全 Work を取得中...");
  const works = await prisma.work.findMany({
    include: {
      editions: {
        select: { isbn13: true, publisher: true, format: true, pageCount: true, publishedAt: true, titleOnCover: true },
      },
    },
    orderBy: { titleNormalized: "asc" },
  });
  console.log(`Work 数: ${works.length}`);

  // バケット分け
  const buckets = new Map<string, WorkRecord[]>();
  for (const work of works) {
    const key = bucketKey(work);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(work);
  }

  const candidateBuckets = [...buckets.entries()].filter(([, v]) => v.length >= 2);

  const extraPairs: Array<{
    workA: WorkRecord;
    workB: WorkRecord;
    score: number;
    breakdown: string;
    keepDecision: string;
  }> = [];

  let totalAutoMerge = 0;
  let exactMatchAutoMerge = 0;

  for (const [, bucket] of candidateBuckets) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const workA = bucket[i];
        const workB = bucket[j];

        const candidateA = toCandidate(workA);
        const candidateB = toCandidate(workB);
        const result = classifyMatch(candidateA, candidateB);

        if (result.classification !== "auto_merge") continue;

        totalAutoMerge++;
        const isExactMatch = workA.title === workB.title && workA.author === workB.author;

        if (isExactMatch) {
          exactMatchAutoMerge++;
          continue;
        }

        // title+author が完全一致でない auto_merge ペア
        const decision = decideKeep(workA, workB);
        extraPairs.push({
          workA,
          workB,
          score: result.score,
          breakdown: scoreBreakdown(candidateA, candidateB),
          keepDecision: `keep=${decision.keep.id.slice(-8)} reason=${decision.reason}`,
        });
      }
    }
  }

  console.log(`auto_merge 総数: ${totalAutoMerge}`);
  console.log(`  title+author 完全一致: ${exactMatchAutoMerge}`);
  console.log(`  title+author 不一致(追加分): ${extraPairs.length}`);
  console.log(`出力先: ${outFile}`);

  // ファイル出力
  const lines: string[] = [];
  lines.push(`=== title+author 不一致の auto_merge ペア: ${extraPairs.length} 件 ===`);
  lines.push(`生成日時: ${new Date().toISOString()}`);
  lines.push("");

  for (let i = 0; i < extraPairs.length; i++) {
    const p = extraPairs[i];
    lines.push(`--- ${i + 1}/${extraPairs.length} ---`);
    lines.push(`Score: ${p.score.toFixed(3)}`);
    lines.push(`${p.breakdown}`);
    lines.push(`決定: ${p.keepDecision}`);
    lines.push(`Work A: id=${p.workA.id}`);
    lines.push(`  title: ${p.workA.title}`);
    lines.push(`  author: ${p.workA.author}`);
    for (const e of p.workA.editions.slice(0, 3)) {
      const year = e.publishedAt ? new Date(e.publishedAt).getFullYear() : "null";
      lines.push(`  Edition: isbn=${e.isbn13 || "null"} publisher=${e.publisher || "null"} pages=${e.pageCount ?? "null"} year=${year}`);
    }
    lines.push(`Work B: id=${p.workB.id}`);
    lines.push(`  title: ${p.workB.title}`);
    lines.push(`  author: ${p.workB.author}`);
    for (const e of p.workB.editions.slice(0, 3)) {
      const year = e.publishedAt ? new Date(e.publishedAt).getFullYear() : "null";
      lines.push(`  Edition: isbn=${e.isbn13 || "null"} publisher=${e.publisher || "null"} pages=${e.pageCount ?? "null"} year=${year}`);
    }
    lines.push("");
  }

  fs.writeFileSync(outFile, lines.join("\n"));
  console.log("完了");

  // コンソールにも全件出力
  console.log();
  for (const line of lines) {
    console.log(line);
  }
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
