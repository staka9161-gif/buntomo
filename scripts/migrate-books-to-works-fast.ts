/**
 * Book → Work + Edition 高速移行スクリプト（堅牢版）
 */

import { PrismaClient, EditionFormat, EditionSource } from "@prisma/client";

const prisma = new PrismaClient();

function guessFormat(book: { label: string | null; labelNormalized: string | null; isElectronic: boolean }): EditionFormat {
  if (book.isElectronic) return "ebook";
  const label = (book.label || book.labelNormalized || "").toLowerCase();
  if (label.includes("文庫")) return "bunko";
  if (label.includes("新書")) return "shinsho";
  return "other";
}

function guessSource(book: { sourceData: string | null }): EditionSource {
  if (!book.sourceData) return "manual";
  try {
    const data = JSON.parse(book.sourceData);
    if (data.openbd) return "openbd";
    if (data.ndl) return "ndl";
    if (data.google) return "google_books";
    if (data.rakuten) return "rakuten";
  } catch { /* ignore */ }
  return "manual";
}

function safeIsbn13(isbn: string | null): string | null {
  if (!isbn) return null;
  const clean = isbn.replace(/[-\s]/g, "");
  return clean.length === 13 ? clean : null;
}

function safeDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  if (year < 1900 || year > 2100) return null;
  return d;
}

async function main() {
  const BATCH_SIZE = 100;

  // 使用済み isbn13 を収集
  const usedIsbns = new Set<string>();
  const existingEditions = await prisma.edition.findMany({
    where: { isbn13: { not: null } },
    select: { isbn13: true },
  });
  for (const e of existingEditions) {
    if (e.isbn13) usedIsbns.add(e.isbn13);
  }

  const total = await prisma.book.count({ where: { migratedWorkId: null } });
  console.log(`残り ${total} 件, 既存ISBN: ${usedIsbns.size} 件`);

  let processed = 0;
  let skippedIsbn = 0;
  let errors = 0;

  while (true) {
    const books = await prisma.book.findMany({
      where: { migratedWorkId: null },
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    if (books.length === 0) break;

    for (const book of books) {
      let isbn13 = safeIsbn13(book.isbn);

      // ISBN 重複回避
      if (isbn13 && usedIsbns.has(isbn13)) {
        isbn13 = null;
        skippedIsbn++;
      }

      try {
        const work = await prisma.work.create({
          data: {
            title: book.title,
            titleNormalized: book.titleNormalized || "",
            author: book.author,
            authorNormalized: (book.authorKana || book.author || "").replace(/\s+/g, ""),
            description: book.description,
          },
        });

        const edition = await prisma.edition.create({
          data: {
            workId: work.id,
            isbn13,
            publisher: book.publisher,
            format: guessFormat(book),
            pageCount: book.totalPages > 0 ? book.totalPages : null,
            publishedAt: safeDate(book.publishedDate),
            coverImageUrl: book.coverImageUrl,
            titleOnCover: book.title,
            source: guessSource(book),
          },
        });

        if (isbn13) usedIsbns.add(isbn13);

        await prisma.book.update({
          where: { id: book.id },
          data: { migratedWorkId: work.id, migratedEditionId: edition.id },
        });

        await prisma.readingStatus.updateMany({
          where: { bookId: book.id },
          data: { workId: work.id, editionId: edition.id },
        });
        await prisma.chatMessage.updateMany({
          where: { bookId: book.id },
          data: { workId: work.id },
        });
        await prisma.readingEvent.updateMany({
          where: { bookId: book.id },
          data: { workId: work.id },
        });

        processed++;
      } catch (e: any) {
        // ISBN 制約エラーの場合、ISBN なしでリトライ
        if (e.message?.includes("Unique constraint") && isbn13) {
          usedIsbns.add(isbn13);
          try {
            const work = await prisma.work.create({
              data: {
                title: book.title,
                titleNormalized: book.titleNormalized || "",
                author: book.author,
                authorNormalized: (book.authorKana || book.author || "").replace(/\s+/g, ""),
                description: book.description,
              },
            });
            const edition = await prisma.edition.create({
              data: {
                workId: work.id, isbn13: null,
                publisher: book.publisher, format: guessFormat(book),
                pageCount: book.totalPages > 0 ? book.totalPages : null,
                publishedAt: safeDate(book.publishedDate),
                coverImageUrl: book.coverImageUrl,
                titleOnCover: book.title, source: guessSource(book),
              },
            });
            await prisma.book.update({
              where: { id: book.id },
              data: { migratedWorkId: work.id, migratedEditionId: edition.id },
            });
            await prisma.readingStatus.updateMany({ where: { bookId: book.id }, data: { workId: work.id, editionId: edition.id } });
            await prisma.chatMessage.updateMany({ where: { bookId: book.id }, data: { workId: work.id } });
            await prisma.readingEvent.updateMany({ where: { bookId: book.id }, data: { workId: work.id } });
            processed++;
            skippedIsbn++;
            continue;
          } catch (e2) {
            errors++;
            console.error(`  ✗ retry failed "${book.title}": ${e2}`);
            // Book を移行不能としてマーク（無限ループ防止）
            await prisma.book.update({ where: { id: book.id }, data: { migratedWorkId: "FAILED" } }).catch(() => {});
            continue;
          }
        }
        errors++;
        console.error(`  ✗ "${book.title}": ${e.message?.slice(0, 100)}`);
        await prisma.book.update({ where: { id: book.id }, data: { migratedWorkId: "FAILED" } }).catch(() => {});
      }
    }

    console.log(`  ${processed + errors}/${total} (成功: ${processed}, ISBN重複スキップ: ${skippedIsbn}, エラー: ${errors})`);
  }

  console.log(`\n完了: ${processed} 件成功, ${errors} 件エラー, ${skippedIsbn} 件ISBN重複スキップ`);
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
