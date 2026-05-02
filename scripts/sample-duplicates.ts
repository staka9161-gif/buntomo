/**
 * 重複 Work のサンプル抽出・目視確認用スクリプト
 *
 * 同一 title + author で複数 Work が存在するグループから
 * ランダムに N 件を抽出し、各ペアの詳細を出力する。
 *
 * 使い方:
 *   npx tsx scripts/sample-duplicates.ts            # 30件
 *   npx tsx scripts/sample-duplicates.ts --count 100 # 100件
 */

import { PrismaClient } from "@prisma/client";
import { calculateMatchScore, type BookCandidate } from "../lib/matching";

const prisma = new PrismaClient();

// コマンドライン引数から件数を取得
function getCount(): number {
  const idx = process.argv.indexOf("--count");
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 30;
}

// Fisher-Yates シャッフルから先頭 n 件を取得
function sampleN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0 && i >= copy.length - n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(Math.max(0, copy.length - n));
}

interface DupeGroup {
  title: string;
  author: string;
  work_count: bigint;
}

async function main() {
  const count = getCount();

  // 重複グループを取得
  const dupeGroups: DupeGroup[] = await prisma.$queryRaw`
    SELECT title, author, COUNT(*) as work_count
    FROM "Work"
    GROUP BY title, author
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

  console.log(`重複グループ総数: ${dupeGroups.length}`);
  console.log(`余剰 Work 総数: ${dupeGroups.reduce((s, g) => s + Number(g.work_count) - 1, 0)}`);
  console.log(`サンプル抽出数: ${Math.min(count, dupeGroups.length)}`);
  console.log();

  // ランダムサンプリング
  const sampled = sampleN(dupeGroups, count);

  let suspiciousCount = 0;

  for (let i = 0; i < sampled.length; i++) {
    const group = sampled[i];

    // このグループの全 Work を取得
    const works = await prisma.work.findMany({
      where: { title: group.title, author: group.author },
      include: {
        editions: {
          select: {
            isbn13: true,
            publisher: true,
            pageCount: true,
            publishedAt: true,
            format: true,
            titleOnCover: true,
          },
          take: 3,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // 最初の2つでペア比較
    const workA = works[0];
    const workB = works[1];

    const candidateA: BookCandidate = {
      title: workA.title,
      titleNormalized: workA.titleNormalized || undefined,
      author: workA.author,
      authorNormalized: workA.authorNormalized || undefined,
      publisher: workA.editions[0]?.publisher || undefined,
      year: workA.editions[0]?.publishedAt ? new Date(workA.editions[0].publishedAt).getFullYear() : undefined,
      pageCount: workA.editions[0]?.pageCount || undefined,
      format: workA.editions[0]?.format || undefined,
      isbn: workA.editions[0]?.isbn13 || undefined,
      originalTitle: workA.originalTitle || undefined,
      ndlWorkId: workA.ndlWorkId || undefined,
      openlibraryWorkId: workA.openlibraryWorkId || undefined,
    };
    const candidateB: BookCandidate = {
      title: workB.title,
      titleNormalized: workB.titleNormalized || undefined,
      author: workB.author,
      authorNormalized: workB.authorNormalized || undefined,
      publisher: workB.editions[0]?.publisher || undefined,
      year: workB.editions[0]?.publishedAt ? new Date(workB.editions[0].publishedAt).getFullYear() : undefined,
      pageCount: workB.editions[0]?.pageCount || undefined,
      format: workB.editions[0]?.format || undefined,
      isbn: workB.editions[0]?.isbn13 || undefined,
      originalTitle: workB.originalTitle || undefined,
      ndlWorkId: workB.ndlWorkId || undefined,
      openlibraryWorkId: workB.openlibraryWorkId || undefined,
    };

    const score = calculateMatchScore(candidateA, candidateB);

    // ページ数/出版年の差異フラグ
    const pageA = candidateA.pageCount;
    const pageB = candidateB.pageCount;
    let pageFlag = "";
    if (pageA && pageB && pageA > 0 && pageB > 0) {
      const ratio = Math.min(pageA, pageB) / Math.max(pageA, pageB);
      if (ratio < 0.5) pageFlag = " ⚠ ページ数差 ±50%超";
    }

    const yearA = candidateA.year;
    const yearB = candidateB.year;
    let yearFlag = "";
    if (yearA && yearB && Math.abs(yearA - yearB) > 10) {
      yearFlag = " ⚠ 出版年差 10年超";
    }

    const isSuspicious = pageFlag || yearFlag || score < 0.92;
    if (isSuspicious) suspiciousCount++;

    console.log(`--- サンプル ${i + 1}/${sampled.length} ${isSuspicious ? "⚠ 要確認" : "✓"} ---`);
    console.log(`グループ内 Work 数: ${group.work_count}`);
    console.log(`Work A: id=${workA.id}`);
    console.log(`  title: ${workA.title}`);
    console.log(`  author: ${workA.author}`);
    if (workA.editions[0]) {
      const e = workA.editions[0];
      console.log(`  Edition: isbn=${e.isbn13 || "null"} publisher=${e.publisher || "null"} pages=${e.pageCount ?? "null"} year=${e.publishedAt ? new Date(e.publishedAt).getFullYear() : "null"} format=${e.format}`);
    } else {
      console.log(`  Edition: なし`);
    }
    console.log(`Work B: id=${workB.id}`);
    console.log(`  title: ${workB.title}`);
    console.log(`  author: ${workB.author}`);
    if (workB.editions[0]) {
      const e = workB.editions[0];
      console.log(`  Edition: isbn=${e.isbn13 || "null"} publisher=${e.publisher || "null"} pages=${e.pageCount ?? "null"} year=${e.publishedAt ? new Date(e.publishedAt).getFullYear() : "null"} format=${e.format}`);
    } else {
      console.log(`  Edition: なし`);
    }
    console.log(`Score: ${score.toFixed(3)}${pageFlag}${yearFlag}`);
    console.log();
  }

  console.log("=== サマリ ===");
  console.log(`サンプル数: ${sampled.length}`);
  console.log(`要確認（⚠）: ${suspiciousCount}`);
  console.log(`問題なし（✓）: ${sampled.length - suspiciousCount}`);
  console.log();
  if (suspiciousCount === 0) {
    console.log("判定: 全件問題なし → 自動統合 GO");
  } else if (suspiciousCount <= 2) {
    console.log("判定: 1〜2件疑いあり → --count 100 で拡大サンプルを推奨");
  } else {
    console.log("判定: 3件以上疑いあり → 全649件 MergeSuggestion 行きを推奨");
  }
}

main()
  .catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
