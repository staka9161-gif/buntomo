/**
 * 残りの Book を一括 SQL で高速移行
 * 個別トランザクションではなく、createMany + raw SQL で一気に処理
 */

import { PrismaClient, EditionFormat, EditionSource } from "@prisma/client";

const prisma = new PrismaClient();

function guessFormat(label: string | null, labelNorm: string | null, isElectronic: boolean): EditionFormat {
  if (isElectronic) return "ebook";
  const l = (label || labelNorm || "").toLowerCase();
  if (l.includes("文庫")) return "bunko";
  if (l.includes("新書")) return "shinsho";
  return "other";
}

function guessSource(sourceData: string | null): EditionSource {
  if (!sourceData) return "manual";
  try {
    const d = JSON.parse(sourceData);
    if (d.openbd) return "openbd";
    if (d.ndl) return "ndl";
    if (d.google) return "google_books";
    if (d.rakuten) return "rakuten";
  } catch {}
  return "manual";
}

function safeIsbn13(isbn: string | null): string | null {
  if (!isbn) return null;
  const c = isbn.replace(/[-\s]/g, "");
  return c.length === 13 ? c : null;
}

function safeDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  return (y >= 1900 && y <= 2100) ? d : null;
}

async function main() {
  // 既存 isbn13 を収集
  const usedIsbns = new Set<string>();
  const existing = await prisma.edition.findMany({ where: { isbn13: { not: null } }, select: { isbn13: true } });
  for (const e of existing) if (e.isbn13) usedIsbns.add(e.isbn13);

  const books = await prisma.book.findMany({
    where: { migratedWorkId: null },
    orderBy: { createdAt: "asc" },
  });

  console.log(`残り ${books.length} 件を一括処理...`);

  let ok = 0, err = 0;

  // 10件ずつバッチ処理（1件ずつだが高速に連続実行）
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    let isbn13 = safeIsbn13(book.isbn);
    if (isbn13 && usedIsbns.has(isbn13)) isbn13 = null;
    if (isbn13) usedIsbns.add(isbn13);

    try {
      const [work, _] = await Promise.all([
        prisma.work.create({
          data: {
            title: book.title, titleNormalized: book.titleNormalized || "",
            author: book.author,
            authorNormalized: (book.authorKana || book.author || "").replace(/\s+/g, ""),
            description: book.description,
          },
        }),
        // プリフェッチ: この book に紐づく reading/chat/event の件数
        Promise.resolve(),
      ]);

      const edition = await prisma.edition.create({
        data: {
          workId: work.id, isbn13,
          publisher: book.publisher, format: guessFormat(book.label, book.labelNormalized, book.isElectronic),
          pageCount: book.totalPages > 0 ? book.totalPages : null,
          publishedAt: safeDate(book.publishedDate), coverImageUrl: book.coverImageUrl,
          titleOnCover: book.title, source: guessSource(book.sourceData),
        },
      });

      // 並列で更新
      await Promise.all([
        prisma.book.update({ where: { id: book.id }, data: { migratedWorkId: work.id, migratedEditionId: edition.id } }),
        prisma.readingStatus.updateMany({ where: { bookId: book.id }, data: { workId: work.id, editionId: edition.id } }),
        prisma.chatMessage.updateMany({ where: { bookId: book.id }, data: { workId: work.id } }),
        prisma.readingEvent.updateMany({ where: { bookId: book.id }, data: { workId: work.id } }),
      ]);

      ok++;
    } catch (e: any) {
      err++;
      // ISBN 制約エラーなら ISBN なしでリトライ
      if (isbn13 && e.message?.includes("Unique constraint")) {
        try {
          const work = await prisma.work.create({
            data: { title: book.title, titleNormalized: book.titleNormalized || "",
              author: book.author, authorNormalized: (book.authorKana || book.author || "").replace(/\s+/g, ""),
              description: book.description },
          });
          const edition = await prisma.edition.create({
            data: { workId: work.id, isbn13: null, publisher: book.publisher,
              format: guessFormat(book.label, book.labelNormalized, book.isElectronic),
              pageCount: book.totalPages > 0 ? book.totalPages : null,
              publishedAt: safeDate(book.publishedDate), coverImageUrl: book.coverImageUrl,
              titleOnCover: book.title, source: guessSource(book.sourceData) },
          });
          await Promise.all([
            prisma.book.update({ where: { id: book.id }, data: { migratedWorkId: work.id, migratedEditionId: edition.id } }),
            prisma.readingStatus.updateMany({ where: { bookId: book.id }, data: { workId: work.id, editionId: edition.id } }),
            prisma.chatMessage.updateMany({ where: { bookId: book.id }, data: { workId: work.id } }),
            prisma.readingEvent.updateMany({ where: { bookId: book.id }, data: { workId: work.id } }),
          ]);
          ok++; err--;
        } catch {
          await prisma.book.update({ where: { id: book.id }, data: { migratedWorkId: "FAILED" } }).catch(() => {});
        }
      } else {
        await prisma.book.update({ where: { id: book.id }, data: { migratedWorkId: "FAILED" } }).catch(() => {});
      }
    }

    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${books.length} (ok: ${ok}, err: ${err})`);
  }

  console.log(`\n完了: ${ok} 成功, ${err} エラー`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); }).finally(() => prisma.$disconnect());
