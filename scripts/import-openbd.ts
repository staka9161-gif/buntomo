/**
 * openBD 全件取り込みスクリプト（PostgreSQL高速版）
 *
 * 使い方:
 *   npx tsx scripts/import-openbd.ts
 *   npx tsx scripts/import-openbd.ts --resume
 *   npx tsx scripts/import-openbd.ts --limit 1000
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();

// ── 設定 ──
const BATCH_SIZE = 100;       // openBD APIは100件/リクエスト上限
const CONCURRENCY = 10;       // 同時APIリクエスト数
const DB_BATCH = 500;         // DB INSERT バッチサイズ
const RETRY_MAX = 3;
const RETRY_DELAY_MS = 2000;
const progressPath = resolve(__dirname, "../scripts/.openbd-progress.json");

// ── CUID ──
let cuidCounter = 0;
function cuid(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const cnt = (cuidCounter++).toString(36).padStart(4, "0");
  return `c${ts}${cnt}${rand}`;
}

// ── 正規化 ──
function normalizeText(text: string): string {
  return text.normalize("NFKC")
    .replace(/[−―‐─\u2010-\u2015]/g, "ー")
    .replace(/\s+/g, " ").trim();
}

function normalizePublisher(pub: string): string {
  return pub.normalize("NFKC")
    .replace(/[（(]?株式会社[）)]?|[（(]?有限会社[）)]?|[（(]株[）)]|㈱/g, "")
    .replace(/\s+/g, " ").trim();
}

function removeSymbols(text: string): string {
  return text.replace(/[、。，．・「」『』【】（）()[\]{}《》〈〉!！?？:：;；\-]/g, "");
}

// ── openBD パース ──
interface OpenBDItem {
  summary?: { isbn?: string; title?: string; author?: string; publisher?: string; pubdate?: string; cover?: string; volume?: string; series?: string };
  onix?: {
    DescriptiveDetail?: {
      TitleDetail?: { TitleElement?: { Subtitle?: { content?: string }; PartNumber?: string } };
      Contributor?: Array<{ PersonName?: { content?: string } }>;
      Collection?: { TitleDetail?: { TitleElement?: Array<{ TitleText?: { content?: string } }> } };
      Extent?: Array<{ ExtentType?: string; ExtentValue?: string }>;
    };
    PublishingDetail?: { Imprint?: { ImprintName?: string } };
    CollateralDetail?: { TextContent?: Array<{ Text?: string; TextType?: string }> };
  };
  hanmoto?: Record<string, unknown>;
}

interface ParsedBook {
  id: string; isbn: string; title: string; titleNormalized: string; titleKana: string | null;
  subtitle: string | null; seriesName: string | null; volume: string | null;
  author: string; authorKana: string | null;
  publisher: string | null; publisherNormalized: string | null; label: string | null; labelNormalized: string | null;
  publishedDate: string | null; totalPages: number; coverImageUrl: string | null; coverSource: string | null;
  description: string | null; sourceData: string;
  completenessScore: number; isElectronic: boolean; isCanonical: boolean;
}

function parseOpenBDItem(item: OpenBDItem): ParsedBook | null {
  const s = item.summary || {};
  const isbn = s.isbn?.replace(/[-\s]/g, "") || null;
  if (!isbn || isbn.length !== 13) return null;
  const title = s.title || "";
  if (!title) return null;

  const onix = item.onix;
  const author = s.author || "不明";
  const publisher = s.publisher || null;
  const coverUrl = s.cover || null;

  const titleDetail = onix?.DescriptiveDetail?.TitleDetail?.TitleElement;
  const subtitle = titleDetail?.Subtitle?.content || null;
  const volume = titleDetail?.PartNumber || s.volume || null;
  const collection = onix?.DescriptiveDetail?.Collection?.TitleDetail?.TitleElement;
  const seriesName = collection?.[0]?.TitleText?.content || s.series || null;
  const imprint = onix?.PublishingDetail?.Imprint?.ImprintName || null;

  // ページ数
  const extents = onix?.DescriptiveDetail?.Extent || [];
  let totalPages = 0;
  for (const type of ["11", "10", "00"]) {
    const ext = extents.find((e) => e.ExtentType === type);
    if (ext?.ExtentValue) {
      const n = parseInt(ext.ExtentValue, 10);
      if (n > 0 && n < 10000) { totalPages = n; break; }
    }
  }

  const texts = onix?.CollateralDetail?.TextContent || [];
  const descText = texts.find((t) => t.TextType === "03" || t.TextType === "02");
  const description = descText?.Text || null;
  const contributors = onix?.DescriptiveDetail?.Contributor || [];
  const authorKana = contributors[0]?.PersonName?.content || null;

  const titleNormalized = removeSymbols(normalizeText(title)).toLowerCase();
  const publisherNormalized = publisher ? normalizePublisher(publisher) : null;
  const label = imprint || seriesName || null;
  const labelNormalized = label ? normalizePublisher(label) : null;

  let completenessScore = 0;
  if (coverUrl) completenessScore += 5;
  if (isbn) completenessScore += 3;
  if (author && author !== "不明") completenessScore += 2;
  if (s.pubdate) completenessScore += 2;
  if (publisher) completenessScore += 3;
  if (totalPages > 0) completenessScore += 3;

  const isElectronic = /kindle|電子書籍|電子版|e-book/i.test(title);

  return {
    id: cuid(), isbn, title: normalizeText(title), titleNormalized, titleKana: null,
    subtitle, seriesName, volume, author: normalizeText(author), authorKana,
    publisher, publisherNormalized, label, labelNormalized,
    publishedDate: s.pubdate || null, totalPages, coverImageUrl: coverUrl,
    coverSource: coverUrl ? "openbd" : null,
    description, sourceData: JSON.stringify({ openbd: { hanmoto: item.hanmoto } }),
    completenessScore, isElectronic, isCanonical: !isElectronic,
  };
}

// ── PostgreSQL バルクINSERT (ON CONFLICT) ──
async function bulkInsert(rows: ParsedBook[]) {
  if (rows.length === 0) return;

  const esc = (s: string | null): string => {
    if (s === null) return "NULL";
    return `'${s.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
  };

  const values = rows.map((r) => `(
    ${esc(r.id)}, ${esc(r.isbn)}, ${esc(r.title)}, ${esc(r.titleNormalized)}, ${esc(r.titleKana)},
    ${esc(r.subtitle)}, ${esc(r.seriesName)}, ${esc(r.volume)},
    ${esc(r.author)}, ${esc(r.authorKana)},
    ${esc(r.publisher)}, ${esc(r.publisherNormalized)}, ${esc(r.label)}, ${esc(r.labelNormalized)},
    ${esc(r.publishedDate)}, ${r.totalPages}, ${esc(r.coverImageUrl)}, ${esc(r.coverSource)},
    ${esc(r.description)}, ${esc(r.sourceData)},
    'C', 0, 0, ${r.completenessScore}, 0, 0,
    ${r.isCanonical}, ${r.isElectronic}, false, false, 0,
    NOW(), NOW()
  )`).join(",\n");

  const sql = `
    INSERT INTO "Book" (
      "id", "isbn", "title", "titleNormalized", "titleKana",
      "subtitle", "seriesName", "volume",
      "author", "authorKana",
      "publisher", "publisherNormalized", "label", "labelNormalized",
      "publishedDate", "totalPages", "coverImageUrl", "coverSource",
      "description", "sourceData",
      "publisherTier", "publisherScore", "popularityScore", "completenessScore", "freshnessScore", "customRank",
      "isCanonical", "isElectronic", "isKarilRecommended", "isLongseller", "registrationCount",
      "createdAt", "updatedAt"
    ) VALUES ${values}
    ON CONFLICT ("isbn") DO UPDATE SET
      "title" = EXCLUDED."title",
      "titleNormalized" = EXCLUDED."titleNormalized",
      "author" = EXCLUDED."author",
      "publisher" = COALESCE(EXCLUDED."publisher", "Book"."publisher"),
      "publisherNormalized" = COALESCE(EXCLUDED."publisherNormalized", "Book"."publisherNormalized"),
      "label" = COALESCE(EXCLUDED."label", "Book"."label"),
      "labelNormalized" = COALESCE(EXCLUDED."labelNormalized", "Book"."labelNormalized"),
      "totalPages" = CASE WHEN EXCLUDED."totalPages" > 0 THEN EXCLUDED."totalPages" ELSE "Book"."totalPages" END,
      "coverImageUrl" = COALESCE(EXCLUDED."coverImageUrl", "Book"."coverImageUrl"),
      "description" = COALESCE(EXCLUDED."description", "Book"."description"),
      "completenessScore" = GREATEST(EXCLUDED."completenessScore", "Book"."completenessScore"),
      "updatedAt" = NOW()
  `;

  await prisma.$executeRawUnsafe(sql);
}

// ── HTTP ──
async function fetchWithRetry(url: string, options?: RequestInit): Promise<Response> {
  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      if (res.ok) return res;
      if (res.status === 429) {
        await sleep(RETRY_DELAY_MS * attempt * 2);
        continue;
      }
      if (attempt === RETRY_MAX) return res;
    } catch (err) {
      if (attempt === RETRY_MAX) throw err;
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error("Unreachable");
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ── 進捗 ──
function saveProgress(processed: number, total: number) {
  writeFileSync(progressPath, JSON.stringify({ processed, total, updatedAt: new Date().toISOString() }));
}
function loadProgress(): { processed: number } | null {
  if (!existsSync(progressPath)) return null;
  try { return JSON.parse(readFileSync(progressPath, "utf-8")); } catch { return null; }
}

// ── メイン ──
async function main() {
  const args = process.argv.slice(2);
  const isResume = args.includes("--resume");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

  console.log("=== openBD 全件取り込み (PostgreSQL高速版) ===");

  console.log("[1/3] Fetching ISBN coverage...");
  const coverageRes = await fetchWithRetry("https://api.openbd.jp/v1/coverage");
  const allIsbns: string[] = await coverageRes.json();
  console.log(`  Total: ${allIsbns.length.toLocaleString()}`);

  let startIndex = 0;
  if (isResume) {
    const p = loadProgress();
    if (p) { startIndex = p.processed; console.log(`  Resuming from ${startIndex.toLocaleString()}`); }
  }

  const endIndex = Math.min(allIsbns.length, startIndex + limit);
  const targetIsbns = allIsbns.slice(startIndex, endIndex);
  console.log(`  To process: ${targetIsbns.length.toLocaleString()}`);

  console.log("[2/3] Importing...");
  const apiBatches: string[][] = [];
  for (let i = 0; i < targetIsbns.length; i += BATCH_SIZE) {
    apiBatches.push(targetIsbns.slice(i, i + BATCH_SIZE));
  }

  let processed = startIndex;
  let upserted = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();
  let dbBuffer: ParsedBook[] = [];

  for (let batchIdx = 0; batchIdx < apiBatches.length; batchIdx += CONCURRENCY) {
    const concurrent = apiBatches.slice(batchIdx, batchIdx + CONCURRENCY);

    const results = await Promise.allSettled(
      concurrent.map(async (batch) => {
        const res = await fetchWithRetry("https://api.openbd.jp/v1/get", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `isbn=${batch.join(",")}`,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as (OpenBDItem | null)[];
      })
    );

    for (const result of results) {
      if (result.status === "rejected") { errors += BATCH_SIZE; continue; }
      for (const item of result.value) {
        if (!item) { skipped++; continue; }
        const parsed = parseOpenBDItem(item);
        if (!parsed) { skipped++; continue; }
        dbBuffer.push(parsed);
      }
    }

    // DBバッチ書き込み
    if (dbBuffer.length >= DB_BATCH) {
      try {
        await bulkInsert(dbBuffer);
        upserted += dbBuffer.length;
      } catch (e) {
        // バルク失敗時は小分けにリトライ
        for (let i = 0; i < dbBuffer.length; i += 50) {
          try {
            await bulkInsert(dbBuffer.slice(i, i + 50));
            upserted += Math.min(50, dbBuffer.length - i);
          } catch { errors += Math.min(50, dbBuffer.length - i); }
        }
      }
      dbBuffer = [];
    }

    processed += concurrent.reduce((s, b) => s + b.length, 0);

    if (batchIdx % 20 === 0 || batchIdx >= apiBatches.length - CONCURRENCY) {
      const elapsed = (Date.now() - startTime) / 1000;
      const done = processed - startIndex;
      const rate = done / Math.max(elapsed, 1);
      const eta = ((targetIsbns.length - done) / Math.max(rate, 1) / 60).toFixed(1);
      const pct = ((done / targetIsbns.length) * 100).toFixed(1);
      console.log(`  [${pct}%] ${processed.toLocaleString()} | Up:${upserted.toLocaleString()} Skip:${skipped} Err:${errors} | ${rate.toFixed(0)}/s ETA:${eta}min`);
      saveProgress(processed, allIsbns.length);
    }
  }

  // 残りのバッファ
  if (dbBuffer.length > 0) {
    try { await bulkInsert(dbBuffer); upserted += dbBuffer.length; } catch { errors += dbBuffer.length; }
  }

  console.log("[3/3] Done!");
  console.log(`  Upserted: ${upserted.toLocaleString()} | Skipped: ${skipped.toLocaleString()} | Errors: ${errors}`);
  const count = await prisma.book.count();
  console.log(`  Books in DB: ${count.toLocaleString()}`);
  saveProgress(processed, allIsbns.length);
  await prisma.$disconnect();
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
