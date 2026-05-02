/**
 * Book → Work + Edition データ移行スクリプト
 *
 * 既存の Book レコードごとに 1 Work + 1 Edition を生成し、
 * ReadingStatus / ChatMessage / ReadingEvent の workId / editionId を埋める。
 *
 * 使い方:
 *   npx tsx scripts/migrate-books-to-works.ts              # dry-run（変更なし）
 *   npx tsx scripts/migrate-books-to-works.ts --execute     # 実行
 */

import { PrismaClient, EditionFormat, EditionSource } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes("--execute");

// ============================================================
// format 判定: label / isElectronic から EditionFormat を推定
// ============================================================
function guessFormat(book: {
  label: string | null;
  labelNormalized: string | null;
  isElectronic: boolean;
}): EditionFormat {
  if (book.isElectronic) return "ebook";

  const label = (book.label || book.labelNormalized || "").toLowerCase();
  if (label.includes("文庫")) return "bunko";
  if (label.includes("新書")) return "shinsho";
  if (label.includes("ペーパーバック") || label.includes("paperback")) return "paperback";

  // デフォルトは other（単行本かどうかはラベルだけでは判断しきれない）
  return "other";
}

// ============================================================
// source 判定: sourceData JSON から推定
// ============================================================
function guessSource(book: { sourceData: string | null }): EditionSource {
  if (!book.sourceData) return "manual";
  try {
    const data = JSON.parse(book.sourceData);
    if (data.openbd) return "openbd";
    if (data.ndl) return "ndl";
    if (data.google) return "google_books";
    if (data.rakuten) return "rakuten";
  } catch {
    // パース失敗は無視
  }
  return "manual";
}

// ============================================================
// ISBN を isbn10 / isbn13 に分類
// ============================================================
function classifyIsbn(isbn: string | null): { isbn10: string | null; isbn13: string | null } {
  if (!isbn) return { isbn10: null, isbn13: null };
  const clean = isbn.replace(/[-\s]/g, "");
  if (clean.length === 13) return { isbn10: null, isbn13: clean };
  if (clean.length === 10) return { isbn10: clean, isbn13: null };
  return { isbn10: null, isbn13: null };
}

// ============================================================
// publishedDate 文字列 → Date | null
// ============================================================
function parsePublishedDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  // "2023-01-15", "2023-01", "2023" などに対応
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// ============================================================
// メイン処理
// ============================================================
async function main() {
  console.log(DRY_RUN ? "=== DRY RUN モード ===" : "=== 実行モード ===");
  console.log();

  // 既に移行済みの Book を除外（migratedWorkId が埋まっていれば移行済み）
  const books = await prisma.book.findMany({
    where: { migratedWorkId: null },
    orderBy: { createdAt: "asc" },
  });

  console.log(`移行対象の Book: ${books.length} 件`);
  if (books.length === 0) {
    console.log("移行対象がありません。");
    return;
  }

  let created = 0;
  let errors = 0;

  for (const book of books) {
    try {
      const { isbn10, isbn13 } = classifyIsbn(book.isbn);
      const format = guessFormat(book);
      const source = guessSource(book);
      const publishedAt = parsePublishedDate(book.publishedDate);

      if (DRY_RUN) {
        console.log(`  [DRY] Book "${book.title}" (${book.isbn}) → Work + Edition (format: ${format}, source: ${source})`);
        created++;
        continue;
      }

      // トランザクションで Work + Edition を作成し、関連レコードを更新
      await prisma.$transaction(async (tx) => {
        // 1. Work 作成
        const work = await tx.work.create({
          data: {
            title: book.title,
            titleNormalized: book.titleNormalized || "",
            author: book.author,
            authorNormalized: (book.authorKana || book.author || "").replace(/\s+/g, ""),
            description: book.description,
          },
        });

        // 2. Edition 作成
        const edition = await tx.edition.create({
          data: {
            workId: work.id,
            isbn10,
            isbn13,
            publisher: book.publisher,
            format,
            pageCount: book.totalPages > 0 ? book.totalPages : null,
            publishedAt,
            coverImageUrl: book.coverImageUrl,
            titleOnCover: book.title,
            source,
          },
        });

        // 3. Book に移行先を記録
        await tx.book.update({
          where: { id: book.id },
          data: {
            migratedWorkId: work.id,
            migratedEditionId: edition.id,
          },
        });

        // 4. ReadingStatus の workId / editionId を埋める
        await tx.readingStatus.updateMany({
          where: { bookId: book.id },
          data: {
            workId: work.id,
            editionId: edition.id,
          },
        });

        // 5. ChatMessage の workId を埋める
        await tx.chatMessage.updateMany({
          where: { bookId: book.id },
          data: { workId: work.id },
        });

        // 6. ReadingEvent の workId を埋める
        await tx.readingEvent.updateMany({
          where: { bookId: book.id },
          data: { workId: work.id },
        });

        console.log(`  ✓ "${book.title}" → Work(${work.id}) + Edition(${edition.id})`);
      });

      created++;
    } catch (e) {
      console.error(`  ✗ "${book.title}" (${book.isbn}): ${e}`);
      errors++;
    }
  }

  console.log();
  console.log(`完了: ${created} 件成功, ${errors} 件エラー`);
  if (DRY_RUN) {
    console.log("※ これは dry-run です。実際に実行するには --execute を付けてください。");
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
