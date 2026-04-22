/**
 * openBD 全件取り込みスクリプト
 *
 * 使い方:
 *   npx tsx scripts/import-openbd.ts
 *   npx tsx scripts/import-openbd.ts --resume    # 中断から再開
 *   npx tsx scripts/import-openbd.ts --limit 1000  # テスト用（1000件のみ）
 *
 * 手順:
 *   1. GET https://api.openbd.jp/v1/coverage → 全ISBN一覧取得
 *   2. 100件ずつ POST https://api.openbd.jp/v1/get → 書誌データ取得
 *   3. SQLiteにUpsert
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── 簡易CUID生成 ──
let cuidCounter = 0;
function cuid(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const cnt = (cuidCounter++).toString(36).padStart(4, "0");
  return `c${ts}${cnt}${rand}`;
}

// ── 設定 ──
const BATCH_SIZE = 100;       // openBD APIは100件/リクエストが上限
const CONCURRENCY = 5;        // 同時リクエスト数（500件/バッチサイクル）
const PROGRESS_FILE = "scripts/.openbd-progress.json";
const RETRY_MAX = 3;
const RETRY_DELAY_MS = 2000;

// ── 正規化関数（normalize.tsの簡易版、スクリプト単体実行用） ──
function normalizeText(text: string): string {
  let s = text.normalize("NFKC");
  s = s.replace(/[−―‐─\u2010\u2011\u2012\u2013\u2014\u2015]/g, "ー");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

function normalizePublisher(publisher: string): string {
  let s = publisher.normalize("NFKC");
  s = s.replace(/[（(]?株式会社[）)]?/g, "");
  s = s.replace(/[（(]?有限会社[）)]?/g, "");
  s = s.replace(/[（(]株[）)]|㈱/g, "");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

function removeSymbols(text: string): string {
  return text.replace(/[、。，．・「」『』【】（）()[\]{}《》〈〉!！?？:：;；\-]/g, "");
}

// ── openBD レスポンス解析 ──
interface OpenBDItem {
  summary?: {
    isbn?: string;
    title?: string;
    author?: string;
    publisher?: string;
    pubdate?: string;
    cover?: string;
    volume?: string;
    series?: string;
  };
  onix?: {
    DescriptiveDetail?: {
      TitleDetail?: {
        TitleElement?: {
          TitleText?: { content?: string };
          Subtitle?: { content?: string };
          PartNumber?: string;
        };
      };
      Contributor?: Array<{
        PersonName?: { content?: string };
        BiographicalNote?: string;
      }>;
      Collection?: {
        TitleDetail?: {
          TitleElement?: Array<{
            TitleText?: { content?: string };
          }>;
        };
      };
      Extent?: Array<{
        ExtentType?: string;
        ExtentValue?: string;
      }>;
    };
    PublishingDetail?: {
      Imprint?: {
        ImprintName?: string;
      };
      Publisher?: {
        PublisherName?: string;
      };
      PublishingDate?: Array<{
        Date?: string;
      }>;
    };
    CollateralDetail?: {
      TextContent?: Array<{
        Text?: string;
        TextType?: string;
      }>;
    };
  };
  hanmoto?: {
    datemodified?: string;
    datecreated?: string;
  };
}

function parseOpenBDItem(item: OpenBDItem) {
  const s = item.summary || {};
  const onix = item.onix;

  const isbn = s.isbn?.replace(/[-\s]/g, "") || null;
  if (!isbn || isbn.length !== 13) return null;

  const title = s.title || "";
  if (!title) return null;

  const author = s.author || "不明";
  const publisher = s.publisher || null;
  const publishedDate = s.pubdate || null;
  const coverUrl = s.cover || null;

  // ONIX由来の詳細データ
  const titleDetail = onix?.DescriptiveDetail?.TitleDetail?.TitleElement;
  const subtitle = titleDetail?.Subtitle?.content || null;
  const volume = titleDetail?.PartNumber || s.volume || null;

  // レーベル/シリーズ (Collection)
  const collection = onix?.DescriptiveDetail?.Collection?.TitleDetail?.TitleElement;
  const seriesName = collection?.[0]?.TitleText?.content || s.series || null;

  // 版元/インプリント（レーベル情報の宝庫）
  const imprint = onix?.PublishingDetail?.Imprint?.ImprintName || null;

  // ページ数
  const extents = onix?.DescriptiveDetail?.Extent || [];
  const pageExtent = extents.find((e) => e.ExtentType === "11");
  const totalPages = pageExtent?.ExtentValue ? parseInt(pageExtent.ExtentValue) : 0;

  // 内容紹介
  const texts = onix?.CollateralDetail?.TextContent || [];
  const descText = texts.find((t) => t.TextType === "03" || t.TextType === "02");
  const description = descText?.Text || null;

  // 著者カナ
  const contributors = onix?.DescriptiveDetail?.Contributor || [];
  const authorKana = contributors[0]?.PersonName?.content || null;

  // 正規化
  const titleNormalized = removeSymbols(normalizeText(title)).toLowerCase();
  const publisherNormalized = publisher ? normalizePublisher(publisher) : null;
  const label = imprint || seriesName || null;
  const labelNormalized = label ? normalizePublisher(label) : null;

  // 書誌完成度スコア
  let completenessScore = 0;
  if (coverUrl) completenessScore += 5;
  if (isbn) completenessScore += 3;
  if (author && author !== "不明") completenessScore += 2;
  if (publishedDate) completenessScore += 2;
  if (publisher) completenessScore += 3;

  // 電子書籍判定
  const isElectronic = /kindle|電子書籍|電子版|e-book/i.test(title);

  return {
    isbn,
    title: normalizeText(title),
    titleNormalized,
    titleKana: null as string | null,
    subtitle,
    seriesName,
    volume,
    author: normalizeText(author),
    authorKana,
    publisher,
    publisherNormalized,
    label,
    labelNormalized,
    publishedDate,
    totalPages: totalPages || 0,
    coverImageUrl: coverUrl,
    coverSource: coverUrl ? "openbd" : null,
    description,
    sourceData: JSON.stringify({ openbd: { hanmoto: item.hanmoto } }),
    completenessScore,
    isElectronic,
    isCanonical: !isElectronic,
  };
}

// ── HTTP helpers ──
async function fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) return res;
      if (res.status === 429) {
        // Rate limited
        const wait = RETRY_DELAY_MS * attempt * 2;
        console.log(`  Rate limited, waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (attempt === RETRY_MAX) return res;
    } catch (err) {
      if (attempt === RETRY_MAX) throw err;
      console.log(`  Retry ${attempt}/${RETRY_MAX}...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error("Unreachable");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── 進捗の保存/復元 ──
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const progressPath = resolve(__dirname, "../scripts/.openbd-progress.json");

function saveProgress(processed: number, total: number, failedIsbns: string[]) {
  writeFileSync(
    progressPath,
    JSON.stringify({ processed, total, failedIsbns, updatedAt: new Date().toISOString() })
  );
}

function loadProgress(): { processed: number; failedIsbns: string[] } | null {
  if (!existsSync(progressPath)) return null;
  try {
    return JSON.parse(readFileSync(progressPath, "utf-8"));
  } catch {
    return null;
  }
}

// ── メイン処理 ──
async function main() {
  const args = process.argv.slice(2);
  const isResume = args.includes("--resume");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

  console.log("=== openBD 全件取り込み ===");
  console.log(`Mode: ${isResume ? "RESUME" : "FRESH"}, Limit: ${limit === Infinity ? "ALL" : limit}`);

  // Step 1: 全ISBN取得
  console.log("\n[1/3] Fetching ISBN coverage list from openBD...");
  const coverageRes = await fetchWithRetry("https://api.openbd.jp/v1/coverage");
  const allIsbns: string[] = await coverageRes.json();
  console.log(`  Total ISBNs in openBD: ${allIsbns.length.toLocaleString()}`);

  // 再開の場合はスキップ
  let startIndex = 0;
  const failedIsbns: string[] = [];
  if (isResume) {
    const progress = loadProgress();
    if (progress) {
      startIndex = progress.processed;
      failedIsbns.push(...(progress.failedIsbns || []));
      console.log(`  Resuming from index ${startIndex.toLocaleString()}`);
    }
  }

  // 上限適用
  const endIndex = Math.min(allIsbns.length, startIndex + limit);
  const targetIsbns = allIsbns.slice(startIndex, endIndex);
  console.log(`  Processing: ${targetIsbns.length.toLocaleString()} ISBNs (index ${startIndex} to ${endIndex})`);

  // Step 2: バッチ取得 → DB Upsert
  console.log("\n[2/3] Fetching book data and upserting to DB...");
  const batches: string[][] = [];
  for (let i = 0; i < targetIsbns.length; i += BATCH_SIZE) {
    batches.push(targetIsbns.slice(i, i + BATCH_SIZE));
  }

  let processed = startIndex;
  let upserted = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx += CONCURRENCY) {
    const concurrentBatches = batches.slice(batchIdx, batchIdx + CONCURRENCY);

    const results = await Promise.allSettled(
      concurrentBatches.map(async (batch) => {
        const res = await fetchWithRetry("https://api.openbd.jp/v1/get", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `isbn=${batch.join(",")}`,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const items: (OpenBDItem | null)[] = await res.json();
        return { batch, items };
      })
    );

    // 全バッチ結果をパースしてバルクINSERT
    const parsedRows: ReturnType<typeof parseOpenBDItem>[] = [];
    for (const result of results) {
      if (result.status === "rejected") {
        errors += BATCH_SIZE;
        continue;
      }
      const { items } = result.value;
      for (const item of items) {
        if (!item) { skipped++; continue; }
        const parsed = parseOpenBDItem(item);
        if (!parsed) { skipped++; continue; }
        parsedRows.push(parsed);
      }
    }

    // SQLiteバルクINSERT OR REPLACE（1トランザクション）
    if (parsedRows.length > 0) {
      try {
        const now = new Date().toISOString();
        const values = parsedRows.map((r) => {
          const e = (s: string | null | undefined) => s ? `'${s.replace(/'/g, "''")}'` : "NULL";
          const b = (v: boolean) => v ? "1" : "0";
          return `(${[
            e(cuid()), e(r.isbn), e(r.title), e(r.titleNormalized), e(r.titleKana),
            e(r.subtitle), e(r.seriesName), e(r.volume),
            e(r.author), e(r.authorKana),
            e(r.publisher), e(r.publisherNormalized), e(r.label), e(r.labelNormalized),
            e(r.publishedDate), r.totalPages, e(r.coverImageUrl), e(r.coverSource),
            e(r.description), e(r.sourceData),
            "'C'", "0", "0", r.completenessScore, "0", "0",
            b(r.isCanonical), b(r.isElectronic), "0", "0", "0",
            e(now), e(now),
          ].join(",")})`;
        });

        await prisma.$executeRawUnsafe(`
          INSERT OR REPLACE INTO Book (
            id, isbn, title, titleNormalized, titleKana,
            subtitle, seriesName, volume,
            author, authorKana,
            publisher, publisherNormalized, label, labelNormalized,
            publishedDate, totalPages, coverImageUrl, coverSource,
            description, sourceData,
            publisherTier, publisherScore, popularityScore, completenessScore, freshnessScore, customRank,
            isCanonical, isElectronic, isKarilRecommended, isLongseller, registrationCount,
            createdAt, updatedAt
          ) VALUES ${values.join(",\n")}`
        );
        upserted += parsedRows.length;
      } catch (err) {
        // バルク失敗時は個別フォールバック
        for (const r of parsedRows) {
          try {
            await prisma.book.upsert({
              where: { isbn: r.isbn },
              create: r,
              update: {
                title: r.title, titleNormalized: r.titleNormalized,
                author: r.author, publisher: r.publisher || undefined,
                publisherNormalized: r.publisherNormalized || undefined,
                label: r.label || undefined,
                coverImageUrl: r.coverImageUrl || undefined,
                completenessScore: r.completenessScore,
                updatedAt: new Date(),
              },
            });
            upserted++;
          } catch { errors++; }
        }
      }
    }

    processed += concurrentBatches.reduce((sum, b) => sum + b.length, 0);

    // 進捗表示（100バッチごと）
    if (batchIdx % 10 === 0 || batchIdx === batches.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = upserted / elapsed;
      const remaining = ((targetIsbns.length - (processed - startIndex)) / rate / 60).toFixed(1);
      const pct = (((processed - startIndex) / targetIsbns.length) * 100).toFixed(1);
      console.log(
        `  [${pct}%] ${processed.toLocaleString()}/${endIndex.toLocaleString()} | ` +
        `Upserted: ${upserted.toLocaleString()} | Skipped: ${skipped} | Errors: ${errors} | ` +
        `${rate.toFixed(0)}/sec | ETA: ${remaining}min`
      );
      saveProgress(processed, allIsbns.length, failedIsbns);
    }
  }

  // Step 3: サマリー
  console.log("\n[3/3] Import complete!");
  console.log(`  Total processed: ${processed.toLocaleString()}`);
  console.log(`  Upserted: ${upserted.toLocaleString()}`);
  console.log(`  Skipped (null/invalid): ${skipped.toLocaleString()}`);
  console.log(`  Errors: ${errors}`);
  if (failedIsbns.length > 0) {
    console.log(`  Failed ISBNs saved to progress file (${failedIsbns.length} items)`);
  }

  // DB件数確認
  const bookCount = await prisma.book.count();
  console.log(`\n  Books in DB: ${bookCount.toLocaleString()}`);

  saveProgress(processed, allIsbns.length, failedIsbns);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
