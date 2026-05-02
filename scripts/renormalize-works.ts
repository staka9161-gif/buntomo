/**
 * Work テーブル再正規化スクリプト (PR-B3)
 *
 * PR-B1/B2 で改善された normalizeAuthor (翻訳者分離) と
 * normalizeTitle (ローマ数字巻数) を全 Work に適用し、
 * titleNormalized / authorNormalized を更新する。
 *
 * 使い方:
 *   npx tsx scripts/renormalize-works.ts                    # dry-run（デフォルト）
 *   npx tsx scripts/renormalize-works.ts --execute          # 本実行
 *   npx tsx scripts/renormalize-works.ts --rollback backups/renormalize-pre-XXXX.json
 *   npx tsx scripts/renormalize-works.ts --dump-all         # dry-run + 全変更をファイル出力
 */

import { PrismaClient } from "@prisma/client";
import { normalizeTitle, normalizeAuthor, parseAuthorField } from "../lib/normalize-work";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";

const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes("--execute");
const DUMP_ALL = process.argv.includes("--dump-all");
const ROLLBACK_IDX = process.argv.indexOf("--rollback");
const ROLLBACK_FILE = ROLLBACK_IDX !== -1 ? process.argv[ROLLBACK_IDX + 1] : null;

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;

// ============================================================
// ロックファイル
// ============================================================
const LOCK_FILE = path.join(__dirname, ".renormalize-works.lock");

function acquireLock(): void {
  if (fs.existsSync(LOCK_FILE)) {
    let info = "";
    try { info = fs.readFileSync(LOCK_FILE, "utf8"); } catch {}
    console.error("エラー: ロックファイルが存在します: " + LOCK_FILE);
    console.error("内容: " + info);
    console.error("別の再正規化が実行中か、前回の実行が異常終了した可能性があります。");
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

process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(130); });
process.on("SIGTERM", () => { releaseLock(); process.exit(143); });
process.on("uncaughtException", (e) => {
  console.error("uncaughtException:", e);
  releaseLock();
  process.exit(1);
});

// ============================================================
// バックアップディレクトリ
// ============================================================
const BACKUPS_DIR = path.join(__dirname, "..", "backups");
function ensureBackupsDir(): void {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// ============================================================
// authorKana 無視判定
// ============================================================
type KanaIgnoreReason = "contains_yaku" | "contains_honyaku" | "contains_slash" | null;

function shouldIgnoreAuthorKana(authorKana: string | null): KanaIgnoreReason {
  if (!authorKana) return null;
  // スラッシュを含む
  if (/[/／]/.test(authorKana)) return "contains_slash";
  // 「ホンヤク」を含む（「ヤク」より先にチェック）
  if (authorKana.includes("ホンヤク")) return "contains_honyaku";
  // 「ヤク」を含む
  if (authorKana.includes("ヤク")) return "contains_yaku";
  return null;
}

// ============================================================
// インタラクティブ確認（--execute 時のみ）
// ============================================================
async function confirmExecution(changeCount: number): Promise<void> {
  if (DRY_RUN) return;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(
      `本実行モードです。${changeCount} 件の Work を更新します。\n` +
      "Neon スナップショットまたは pg_dump バックアップを取得しましたか？\n" +
      "  取得日時を入力 (例: 2026-05-02 12:00)\n" +
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
interface WorkRow {
  id: string;
  title: string;
  author: string;
  authorKana: string | null; // Book テーブルから逆引きで取得
  titleNormalized: string;
  authorNormalized: string;
}

interface ChangeRecord {
  workId: string;
  title: string;
  author: string;
  authorKana: string | null;
  old: { titleNormalized: string; authorNormalized: string };
  new: { titleNormalized: string; authorNormalized: string };
  pattern: ChangePattern;
  classifyReason: string;
  kanaIgnoreReason: KanaIgnoreReason;
  volumeExtracted: string | null;
  parsedAuthors: string[];
  parsedTranslators: string[];
}

type ChangePattern = "translatorSeparation" | "romanNumeral" | "both" | "other";

interface DryRunResult {
  timestamp: string;
  totalWorks: number;
  changedWorks: number;
  patterns: {
    translatorSeparation: number;
    romanNumeral: number;
    both: number;
    other: number;
    kanaIgnored: number;
  };
  kanaIgnoreBreakdown: {
    contains_yaku: number;
    contains_honyaku: number;
    contains_slash: number;
  };
  samples: {
    translatorSeparation: ChangeRecord[];
    romanNumeral: ChangeRecord[];
    both: ChangeRecord[];
    other: ChangeRecord[];
    kanaIgnored: ChangeRecord[];
  };
  allChanges: ChangeRecord[];
}

// ============================================================
// 変更パターンの分類
// parseAuthorField の結果で translators が非空の場合のみ
// translatorSeparation と判定（中黒除去等との混同を防ぐ）
// ============================================================
function classifyChange(
  oldTitle: string, newTitle: string,
  oldAuthor: string, newAuthor: string,
  volumeExtracted: string | null,
  hasTranslators: boolean,
): ChangePattern {
  const titleChanged = oldTitle !== newTitle;
  const authorChanged = oldAuthor !== newAuthor;

  // 翻訳者分離判定: parseAuthorField で translators が実際に検出された場合のみ
  const isTranslatorSeparation = authorChanged && hasTranslators;
  // ローマ数字判定: volume が新規抽出された且つタイトルが変わった
  const isRomanNumeral = titleChanged && volumeExtracted !== null;

  if (isTranslatorSeparation && isRomanNumeral) return "both";
  if (isTranslatorSeparation) return "translatorSeparation";
  if (isRomanNumeral) return "romanNumeral";
  return "other";
}

// ============================================================
// 1件の Work を再正規化
// ============================================================
function renormalizeWork(work: WorkRow): {
  titleNormalized: string;
  authorNormalized: string;
  volumeExtracted: string | null;
  kanaIgnoreReason: KanaIgnoreReason;
  hasTranslators: boolean;
  parsedAuthors: string[];
  parsedTranslators: string[];
} {
  // タイトル正規化
  const titleResult = normalizeTitle(work.title);
  const newTitleNormalized = titleResult.normalized;
  const volumeExtracted = titleResult.volume;

  // 著者正規化: parseAuthorField で原著者を抽出
  const parsed = parseAuthorField(work.author);
  // 著者 > 編者 > 元の author 全文 の順でフォールバック
  // 「/編」の人しかいない場合も代表人物として使う
  const primaryAuthor = parsed.authors[0] || parsed.editors[0] || work.author;

  // authorKana の無視判定
  const kanaIgnoreReason = shouldIgnoreAuthorKana(work.authorKana);
  const kanaToUse = kanaIgnoreReason ? undefined : (work.authorKana || undefined);

  const newAuthorNormalized = normalizeAuthor(primaryAuthor, kanaToUse);

  return {
    titleNormalized: newTitleNormalized,
    authorNormalized: newAuthorNormalized,
    volumeExtracted,
    kanaIgnoreReason,
    hasTranslators: parsed.translators.length > 0,
    parsedAuthors: parsed.authors,
    parsedTranslators: parsed.translators,
  };
}

// ============================================================
// ロールバック処理
// ============================================================
async function executeRollback(dumpFile: string): Promise<void> {
  console.log(`=== ロールバック: ${dumpFile} ===`);

  if (!fs.existsSync(dumpFile)) {
    console.error("ファイルが見つかりません: " + dumpFile);
    process.exit(1);
  }

  const dump: Array<{ workId: string; old: { titleNormalized: string; authorNormalized: string } }> =
    JSON.parse(fs.readFileSync(dumpFile, "utf8"));

  console.log(`復元対象: ${dump.length} 件`);

  let restored = 0;
  let errors = 0;

  for (let i = 0; i < dump.length; i += BATCH_SIZE) {
    const batch = dump.slice(i, i + BATCH_SIZE);
    try {
      await prisma.$transaction(
        batch.map((record) =>
          prisma.work.update({
            where: { id: record.workId },
            data: {
              titleNormalized: record.old.titleNormalized,
              authorNormalized: record.old.authorNormalized,
            },
          })
        )
      );
      restored += batch.length;
      console.log(`  [${restored}/${dump.length}] 復元完了`);
    } catch (e) {
      console.error(`  バッチエラー (offset ${i}):`, e);
      errors += batch.length;
    }
  }

  console.log();
  console.log(`=== ロールバック完了 ===`);
  console.log(`  復元: ${restored} 件`);
  console.log(`  エラー: ${errors} 件`);

  if (restored !== dump.length) {
    console.error("警告: 復元件数がダンプ件数と一致しません！");
    process.exit(1);
  }
}

// ============================================================
// バッチ UPDATE (リトライ付き)
// ============================================================
async function executeBatchUpdate(
  changes: ChangeRecord[],
  batchIndex: number,
  totalBatches: number,
): Promise<{ success: number; failed: number }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await prisma.$transaction(
        changes.map((c) =>
          prisma.work.update({
            where: { id: c.workId },
            data: {
              titleNormalized: c.new.titleNormalized,
              authorNormalized: c.new.authorNormalized,
            },
          })
        )
      );
      return { success: changes.length, failed: 0 };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`  バッチ ${batchIndex + 1}/${totalBatches} 試行 ${attempt}/${MAX_RETRIES} 失敗: ${errMsg}`);
      if (attempt === MAX_RETRIES) {
        return { success: 0, failed: changes.length };
      }
      // リトライ前に短い待機
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return { success: 0, failed: changes.length };
}

// ============================================================
// メイン処理
// ============================================================
async function main() {
  // ロールバックモード
  if (ROLLBACK_FILE) {
    await executeRollback(ROLLBACK_FILE);
    return;
  }

  acquireLock();

  const mode = DRY_RUN ? "DRY RUN" : "実行";
  console.log(`=== Work 再正規化 (${mode}) ===`);
  console.log();

  // Neon ウォームアップ
  await prisma.$queryRaw`SELECT 1`;

  // 全 Work を取得 + Book テーブルから authorKana を逆引き
  console.log("全 Work を取得中...");
  const works = await prisma.work.findMany({
    select: {
      id: true,
      title: true,
      author: true,
      titleNormalized: true,
      authorNormalized: true,
    },
  });

  // Book.migratedWorkId で authorKana を逆引き
  console.log("authorKana を Book テーブルから取得中...");
  const booksWithKana = await prisma.book.findMany({
    where: { migratedWorkId: { not: null } },
    select: { migratedWorkId: true, authorKana: true },
  });
  const kanaByWorkId = new Map<string, string | null>();
  for (const b of booksWithKana) {
    if (b.migratedWorkId && b.authorKana) {
      // 同一 Work に複数 Book が紐付く場合は最初の1つを使用
      if (!kanaByWorkId.has(b.migratedWorkId)) {
        kanaByWorkId.set(b.migratedWorkId, b.authorKana);
      }
    }
  }
  console.log(`  authorKana 取得: ${kanaByWorkId.size} 件`);

  const allWorks: WorkRow[] = works.map((w) => ({
    id: w.id,
    title: w.title,
    author: w.author,
    authorKana: kanaByWorkId.get(w.id) || null,
    titleNormalized: w.titleNormalized,
    authorNormalized: w.authorNormalized,
  }));

  const totalWorks = allWorks.length;
  console.log(`対象 Work: ${totalWorks} 件`);
  console.log();

  // 全件を処理して差分を検出
  const changes: ChangeRecord[] = [];
  const kanaIgnoreStats = { contains_yaku: 0, contains_honyaku: 0, contains_slash: 0 };
  let processed = 0;

  for (const work of allWorks) {
    const result = renormalizeWork(work);

    // kana 無視統計
    if (result.kanaIgnoreReason) {
      kanaIgnoreStats[result.kanaIgnoreReason]++;
    }

    // 差分チェック
    const titleChanged = work.titleNormalized !== result.titleNormalized;
    const authorChanged = work.authorNormalized !== result.authorNormalized;

    if (titleChanged || authorChanged) {
      const pattern = classifyChange(
        work.titleNormalized, result.titleNormalized,
        work.authorNormalized, result.authorNormalized,
        result.volumeExtracted,
        result.hasTranslators,
      );

      // 分類理由の生成
      let classifyReason = "";
      if (pattern === "translatorSeparation") {
        classifyReason = `parseAuthorField で translators=${JSON.stringify(result.parsedTranslators)}`;
      } else if (pattern === "romanNumeral") {
        classifyReason = `volume="${result.volumeExtracted}" を抽出`;
      } else if (pattern === "both") {
        classifyReason = `translators=${JSON.stringify(result.parsedTranslators)} + volume="${result.volumeExtracted}"`;
      } else {
        classifyReason = authorChanged ? "authorNormalized 正規化差分" : "titleNormalized 正規化差分";
      }

      changes.push({
        workId: work.id,
        title: work.title,
        author: work.author,
        authorKana: work.authorKana,
        old: { titleNormalized: work.titleNormalized, authorNormalized: work.authorNormalized },
        new: { titleNormalized: result.titleNormalized, authorNormalized: result.authorNormalized },
        pattern,
        classifyReason,
        kanaIgnoreReason: result.kanaIgnoreReason,
        volumeExtracted: result.volumeExtracted,
        parsedAuthors: result.parsedAuthors,
        parsedTranslators: result.parsedTranslators,
      });
    }

    processed++;
    if (processed % BATCH_SIZE === 0 || processed === totalWorks) {
      process.stdout.write(`\r  [${processed}/${totalWorks}] 処理中... (変更: ${changes.length} 件)`);
    }
  }
  console.log();
  console.log();

  // パターン分類
  const patterns = {
    translatorSeparation: changes.filter((c) => c.pattern === "translatorSeparation").length,
    romanNumeral: changes.filter((c) => c.pattern === "romanNumeral").length,
    both: changes.filter((c) => c.pattern === "both").length,
    other: changes.filter((c) => c.pattern === "other").length,
    kanaIgnored: changes.filter((c) => c.kanaIgnoreReason !== null).length,
  };

  // サンプル抽出 (各パターン最大10件)
  const samples = {
    translatorSeparation: changes.filter((c) => c.pattern === "translatorSeparation").slice(0, 10),
    romanNumeral: changes.filter((c) => c.pattern === "romanNumeral").slice(0, 10),
    both: changes.filter((c) => c.pattern === "both").slice(0, 10),
    other: changes.filter((c) => c.pattern === "other").slice(0, 10),
    kanaIgnored: changes.filter((c) => c.kanaIgnoreReason !== null).slice(0, 30),
  };

  // --- サマリ表示 ---
  console.log("--- 変更サマリ ---");
  console.log(`変更が発生する Work: ${changes.length} 件 (${(changes.length / totalWorks * 100).toFixed(1)}%)`);
  console.log();
  console.log("--- 変更パターン分類 ---");
  console.log(`  翻訳者分離による authorNormalized 変更: ${patterns.translatorSeparation} 件`);
  console.log(`  ローマ数字 volume 抽出による titleNormalized 変更: ${patterns.romanNumeral} 件`);
  console.log(`  両方の変更: ${patterns.both} 件`);
  console.log(`  その他 (長音正規化/NFKC差分/記号除去改善): ${patterns.other} 件`);
  console.log();
  console.log("--- kana 無視判定統計 ---");
  console.log(`  kana 無視と判定された Work 総数: ${kanaIgnoreStats.contains_yaku + kanaIgnoreStats.contains_honyaku + kanaIgnoreStats.contains_slash} 件`);
  console.log(`    「ヤク」検出: ${kanaIgnoreStats.contains_yaku} 件`);
  console.log(`    「ホンヤク」検出: ${kanaIgnoreStats.contains_honyaku} 件`);
  console.log(`    スラッシュ検出: ${kanaIgnoreStats.contains_slash} 件`);
  console.log();

  // --- パターン別サンプル表示 ---
  function printSamples(label: string, items: ChangeRecord[]): void {
    if (items.length === 0) return;
    console.log(`--- ${label} サンプル (${items.length} 件) ---`);
    for (const c of items) {
      console.log(`  Work "${c.title}" (id: ${c.workId.slice(0, 8)}...)`);
      console.log(`    Work.author (元データ): "${c.author}"`);
      console.log(`    authorKana: "${c.authorKana || "(null)"}"`);
      console.log(`    parseAuthorField → authors: ${JSON.stringify(c.parsedAuthors)}, translators: ${JSON.stringify(c.parsedTranslators)}`);
      console.log(`    分類理由: ${c.classifyReason}`);
      if (c.old.titleNormalized !== c.new.titleNormalized) {
        console.log(`    titleNormalized: "${c.old.titleNormalized}" → "${c.new.titleNormalized}"`);
      }
      if (c.old.authorNormalized !== c.new.authorNormalized) {
        console.log(`    authorNormalized: "${c.old.authorNormalized}" → "${c.new.authorNormalized}"`);
      }
      if (c.volumeExtracted) {
        console.log(`    volume (ログのみ): ${c.volumeExtracted}`);
      }
      if (c.kanaIgnoreReason) {
        console.log(`    kana無視理由: ${c.kanaIgnoreReason}`);
      }
    }
    console.log();
  }

  printSamples("翻訳者分離", samples.translatorSeparation);
  printSamples("ローマ数字", samples.romanNumeral);
  printSamples("両方", samples.both);
  printSamples("その他", samples.other);
  printSamples("kana 無視判定", samples.kanaIgnored);

  // --- 翻訳者残骸チェック (VI) ---
  // translatorSeparation に分類された全件で、translators に残骸がないか確認
  const translatorWarnings: string[] = [];
  const translatorSepAll = changes.filter((c) => c.pattern === "translatorSeparation" || c.pattern === "both");
  for (const sample of translatorSepAll) {
    for (const t of sample.parsedTranslators) {
      if (/[/／]/.test(t) || /^著/.test(t) || /著$/.test(t) || /^翻訳/.test(t)) {
        translatorWarnings.push(`  残骸検出: workId=${sample.workId.slice(0, 8)}..., translator="${t}", author="${sample.author}"`);
      }
    }
  }
  console.log("--- 翻訳者残骸チェック ---");
  if (translatorWarnings.length === 0) {
    console.log("  警告 0 件 ✓ (translatorSeparation/both の全 translators に残骸なし)");
  } else {
    console.log(`  警告 ${translatorWarnings.length} 件:`);
    for (const w of translatorWarnings.slice(0, 30)) {
      console.log(w);
    }
    if (translatorWarnings.length > 30) {
      console.log(`  ... 他 ${translatorWarnings.length - 30} 件`);
    }
  }
  console.log();

  // --- 構造化データの保存 ---
  ensureBackupsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const dryRunResult: DryRunResult = {
    timestamp,
    totalWorks,
    changedWorks: changes.length,
    patterns,
    kanaIgnoreBreakdown: kanaIgnoreStats,
    samples,
    allChanges: DUMP_ALL ? changes : [],
  };

  const dryRunPath = path.join(BACKUPS_DIR, `renormalize-dry-run-${timestamp}.json`);
  fs.writeFileSync(dryRunPath, JSON.stringify(dryRunResult, null, 2));
  console.log(`dry-run 結果を保存: ${dryRunPath}`);

  if (DRY_RUN) {
    console.log();
    console.log("=== DRY RUN 完了 (DB への変更なし) ===");
    console.log(`推定実行時間: バッチ ${Math.ceil(changes.length / BATCH_SIZE)} 回 × ~100ms ≈ ${(Math.ceil(changes.length / BATCH_SIZE) * 0.1).toFixed(1)}秒`);

    if (DUMP_ALL) {
      const allChangesPath = path.join(BACKUPS_DIR, `renormalize-all-changes-${timestamp}.json`);
      fs.writeFileSync(allChangesPath, JSON.stringify(changes, null, 2));
      console.log(`全変更レコード: ${allChangesPath}`);
    }
    return;
  }

  // === 本実行モード ===

  // 変更前データのバックアップ（ロールバック用）
  const preBackupPath = path.join(BACKUPS_DIR, `renormalize-pre-${timestamp}.json`);
  const preBackup = changes.map((c) => ({
    workId: c.workId,
    old: c.old,
  }));
  fs.writeFileSync(preBackupPath, JSON.stringify(preBackup, null, 2));
  console.log(`変更前バックアップ: ${preBackupPath}`);
  console.log();

  // インタラクティブ確認
  await confirmExecution(changes.length);

  // バッチ UPDATE 実行
  console.log("--- UPDATE 実行中 ---");
  let totalSuccess = 0;
  let totalFailed = 0;
  const totalBatches = Math.ceil(changes.length / BATCH_SIZE);

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const batch = changes.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    const result = await executeBatchUpdate(batch, batchIndex, totalBatches);
    totalSuccess += result.success;
    totalFailed += result.failed;
    console.log(`  [${batchIndex + 1}/${totalBatches}] 完了 (成功: ${result.success}, 失敗: ${result.failed})`);
  }

  console.log();
  console.log("=== 本実行完了 ===");
  console.log(`  成功: ${totalSuccess} 件`);
  console.log(`  失敗: ${totalFailed} 件`);
  console.log(`  バックアップ: ${preBackupPath}`);
  console.log(`  ロールバック: npx tsx scripts/renormalize-works.ts --rollback ${preBackupPath}`);

  if (totalFailed > 0) {
    console.error("警告: 一部の Work の更新に失敗しました。");
    process.exit(1);
  }

  // 期待値ダンプ（検証スクリプト用）
  const expectedPath = path.join(BACKUPS_DIR, `renormalize-expected-${timestamp}.json`);
  const expected = changes.map((c) => ({
    workId: c.workId,
    expected: c.new,
  }));
  fs.writeFileSync(expectedPath, JSON.stringify(expected, null, 2));
  console.log(`  検証用期待値: ${expectedPath}`);
  console.log(`  検証コマンド: npx tsx scripts/verify-renormalize.ts ${expectedPath}`);
}

main()
  .catch((e) => {
    console.error("致命的エラー:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
