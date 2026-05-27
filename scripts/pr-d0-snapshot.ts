/**
 * PR-D0 Before/After スナップショット取得スクリプト
 *
 * 使い方:
 *   npx tsx scripts/pr-d0-snapshot.ts --label before
 *   npx tsx scripts/pr-d0-snapshot.ts --label after
 */

import { metaSearch } from "../lib/search/meta-search";
import * as fs from "fs";
import * as path from "path";

const QUERIES = [
  "村上春樹",
  "ノルウェイの森",
  "カフカ",
  "東野圭吾",
  "容疑者X",
  "人間失格",
  "夏目漱石",
  "銀河鉄道の夜",
];

const label = process.argv.includes("--label")
  ? process.argv[process.argv.indexOf("--label") + 1]
  : "snapshot";

async function main() {
  const results: Record<string, { query: string; tookMs: number; sourcesUsed: string[]; cacheHit: boolean; top5: Array<{ title: string; author: string; score: number }> }> = {};

  for (const query of QUERIES) {
    console.log(`検索中: "${query}"...`);
    const start = Date.now();
    try {
      const result = await metaSearch(query);
      const tookMs = result.meta.tookMs;
      const top5 = result.books.slice(0, 5).map((b) => ({
        title: b.title,
        author: b.author,
        score: Math.round(b._finalScore * 100) / 100,
      }));
      results[query] = {
        query,
        tookMs,
        sourcesUsed: result.meta.sourcesUsed,
        cacheHit: result.meta.cacheHit,
        top5,
      };
      console.log(`  → ${result.books.length} 件, ${tookMs}ms, sources: ${result.meta.sourcesUsed.join(",")}`);
      for (const r of top5) {
        console.log(`    [${r.score}] "${r.title}" | ${r.author}`);
      }
    } catch (e) {
      console.error(`  エラー: ${e}`);
      results[query] = { query, tookMs: Date.now() - start, sourcesUsed: [], cacheHit: false, top5: [] };
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = path.join(__dirname, "..", "backups", `pr-d0-${label}-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n保存: ${outPath}`);
}

main().catch(console.error);
