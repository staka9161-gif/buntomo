/**
 * totalPages=0 の本を openBD から補完するスクリプト
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== ページ数補完スクリプト ===\n");

  // totalPages=0 かつ ISBN がある本を取得
  const books = await prisma.book.findMany({
    where: { totalPages: 0, isbn: { not: null } },
    select: { id: true, isbn: true, title: true },
  });
  console.log(`totalPages=0 の本: ${books.length}件`);
  if (books.length === 0) { await prisma.$disconnect(); return; }

  // 100件ずつ openBD に問い合わせ
  let updated = 0;
  for (let i = 0; i < books.length; i += 100) {
    const batch = books.slice(i, i + 100);
    const isbns = batch.map(b => b.isbn).filter(Boolean) as string[];

    try {
      const res = await fetch("https://api.openbd.jp/v1/get", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `isbn=${isbns.join(",")}`,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;

      const items = await res.json();
      for (let j = 0; j < items.length; j++) {
        const item = items[j];
        if (!item) continue;

        // ページ数を取得
        const extents = item.onix?.DescriptiveDetail?.Extent || [];
        let pages = 0;
        for (const type of ["11", "10", "00"]) {
          const ext = extents.find((e: { ExtentType?: string; ExtentValue?: string }) => e.ExtentType === type);
          if (ext?.ExtentValue) {
            const n = parseInt(ext.ExtentValue, 10);
            if (n > 0 && n < 10000) { pages = n; break; }
          }
        }

        // 出版社も補完
        const publisher = item.summary?.publisher || item.onix?.PublishingDetail?.Publisher?.PublisherName || null;

        if (pages > 0 || publisher) {
          const data: Record<string, unknown> = {};
          if (pages > 0) data.totalPages = pages;
          if (publisher) data.publisher = publisher;

          const isbn = isbns[j];
          if (isbn) {
            try {
              await prisma.book.update({ where: { isbn }, data });
              if (pages > 0) updated++;
            } catch {}
          }
        }
      }
    } catch (e) {
      console.log(`  Batch error: ${(e as Error).message?.slice(0, 60)}`);
    }

    if (i % 500 === 0) {
      console.log(`  ${i}/${books.length} checked, ${updated} updated`);
    }
  }

  console.log(`\nDone! Updated ${updated} books with page counts`);

  // NDL からも補完（openBD で取れなかった分）
  const remaining = await prisma.book.findMany({
    where: { totalPages: 0, isbn: { not: null } },
    select: { isbn: true },
    take: 500,
  });
  console.log(`\nRemaining without pages: ${remaining.length}`);

  if (remaining.length > 0) {
    console.log("Trying NDL...");
    let ndlUpdated = 0;
    for (const book of remaining) {
      if (!book.isbn) continue;
      try {
        const res = await fetch(
          `https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${book.isbn}&cnt=1`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) continue;
        const xml = await res.text();
        const extentMatch = xml.match(/<dcterms:extent>([^<]+)<\/dcterms:extent>/);
        if (extentMatch) {
          const pagesMatch = extentMatch[1].match(/(\d+)\s*(?:p|ページ)/);
          if (pagesMatch) {
            const pages = parseInt(pagesMatch[1], 10);
            if (pages > 0 && pages < 10000) {
              await prisma.book.update({ where: { isbn: book.isbn }, data: { totalPages: pages } });
              ndlUpdated++;
            }
          }
        }
        // NDL rate limit 対策
        await new Promise(r => setTimeout(r, 200));
      } catch {}
    }
    console.log(`NDL: Updated ${ndlUpdated} books`);
  }

  await prisma.$disconnect();
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
