/**
 * custom_rank 事前計算バッチ
 *
 * 使い方:
 *   npx tsx scripts/calculate-ranks.ts
 *
 * 1. 出版社ティアの自動判定（book_countベース）
 * 2. S層レーベルの手動オーバーライド
 * 3. 各書籍のcustom_rankを計算してDBに保存
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── S層レーベル手動オーバーライド ──
const S_TIER_LABELS = new Set([
  "新潮文庫", "新潮新書", "新潮選書",
  "講談社文庫", "講談社現代新書", "講談社学術文庫", "講談社文芸文庫",
  "文春文庫", "文春新書",
  "角川文庫", "角川新書", "角川ソフィア文庫", "角川選書",
  "集英社文庫", "集英社新書",
  "小学館文庫", "小学館新書",
  "岩波文庫", "岩波新書", "岩波現代文庫", "岩波少年文庫", "岩波ジュニア新書",
  "河出文庫",
  "ちくま文庫", "ちくま新書", "ちくま学芸文庫", "ちくまプリマー新書",
  "光文社文庫", "光文社古典新訳文庫", "光文社新書",
  "中公文庫", "中公新書", "中公新書ラクレ",
  "ハヤカワ文庫SF", "ハヤカワ文庫JA", "ハヤカワ文庫NV", "ハヤカワ文庫NF",
  "ハヤカワ・ミステリ文庫", "ハヤカワepi文庫", "ハヤカワ・ノンフィクション文庫",
  "創元推理文庫", "創元SF文庫",
  "幻冬舎文庫", "幻冬舎新書",
  "徳間文庫",
  "双葉文庫",
  "朝日文庫", "朝日新書",
  "扶桑社文庫",
  "祥伝社文庫", "祥伝社新書",
  "PHP新書", "PHP文庫",
  "ブルーバックス",
  "白水Uブックス",
  "平凡社ライブラリー", "平凡社新書",
  "NHKブックス",
  "実業之日本社文庫",
  "宝島社文庫",
  "ポプラ文庫",
  "ハルキ文庫",
  "竹書房文庫",
  "白泉社文庫",
  "SB新書",
  "講談社+α文庫", "講談社+α新書",
]);

// ── A層出版社（明示的に指定） ──
const A_TIER_PUBLISHERS = new Set([
  "新潮社", "講談社", "文藝春秋", "文芸春秋", "KADOKAWA", "角川書店",
  "集英社", "小学館", "岩波書店", "河出書房新社", "筑摩書房",
  "光文社", "中央公論新社", "早川書房", "白水社", "みすず書房",
  "東京創元社", "幻冬舎", "ダイヤモンド社", "東洋経済新報社", "日経BP",
  "朝日新聞出版", "NHK出版", "平凡社", "静山社", "文響社",
  "徳間書店", "双葉社", "PHP研究所", "扶桑社", "宝島社", "ポプラ社",
  "祥伝社", "実業之日本社", "青土社", "作品社", "毎日新聞出版",
  "人文書院",
]);

function normalizeForLookup(name: string): string {
  return name.normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .replace(/[株式会社(株)㈱（）()]/g, "")
    .toLowerCase();
}

// ── ティア判定 ──
function determineTier(
  publisher: string | null,
  label: string | null,
  bookCountForPublisher: number,
): { tier: string; score: number } {
  // 1. S層レーベルチェック
  if (label) {
    const normLabel = normalizeForLookup(label);
    for (const sLabel of S_TIER_LABELS) {
      if (normLabel === normalizeForLookup(sLabel) || normLabel.includes(normalizeForLookup(sLabel))) {
        return { tier: "S", score: 50 };
      }
    }
  }

  // 2. A層出版社チェック
  if (publisher) {
    const normPub = normalizeForLookup(publisher);
    for (const aPub of A_TIER_PUBLISHERS) {
      if (normPub === normalizeForLookup(aPub) || normPub.includes(normalizeForLookup(aPub))) {
        return { tier: "A", score: 30 };
      }
    }
  }

  // 3. book_countベース自動判定
  if (bookCountForPublisher >= 5000) return { tier: "A", score: 30 };
  if (bookCountForPublisher >= 1000) return { tier: "B", score: 15 };
  if (bookCountForPublisher >= 100) return { tier: "C", score: 0 };
  if (bookCountForPublisher >= 10) return { tier: "C", score: 0 };
  if (bookCountForPublisher >= 3) return { tier: "D", score: -15 };
  return { tier: "D", score: -25 };
}

// ── freshness スコア ──
function calculateFreshness(publishedDate: string | null): number {
  if (!publishedDate) return 0;
  const match = publishedDate.match(/(\d{4})/);
  if (!match) return 0;
  const year = parseInt(match[1]);
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  if (age <= 1) return 5;
  if (age <= 3) return 2;
  return 0;
}

// ── penalty ──
function calculatePenalty(title: string, isElectronic: boolean): number {
  let penalty = 0;
  if (isElectronic) penalty -= 10;
  if (/【.*?】/.test(title)) penalty -= 2;
  if (/完全版|特装版|豪華版|限定版|愛蔵版/.test(title)) penalty -= 10;
  return penalty;
}

// ── メイン ──
async function main() {
  console.log("=== custom_rank 計算バッチ ===\n");

  // Step 1: 出版社ごとのbook_countを集計
  console.log("[1/3] Counting books per publisher...");
  const publisherCounts = await prisma.$queryRawUnsafe<Array<{ publisherNormalized: string; cnt: number }>>(
    `SELECT publisherNormalized, COUNT(*) as cnt FROM Book WHERE publisherNormalized IS NOT NULL GROUP BY publisherNormalized`
  );
  const pubCountMap = new Map<string, number>();
  for (const row of publisherCounts) {
    pubCountMap.set(row.publisherNormalized, Number(row.cnt));
  }
  console.log(`  Found ${pubCountMap.size.toLocaleString()} unique publishers`);

  // Step 2: 全書籍のスコアを計算
  console.log("[2/3] Calculating scores for all books...");
  const CHUNK_SIZE = 5000;
  let offset = 0;
  let updated = 0;
  const totalBooks = await prisma.book.count();
  console.log(`  Total books: ${totalBooks.toLocaleString()}`);

  while (true) {
    const books = await prisma.book.findMany({
      select: {
        id: true,
        title: true,
        publisher: true,
        publisherNormalized: true,
        label: true,
        labelNormalized: true,
        publishedDate: true,
        coverImageUrl: true,
        isbn: true,
        author: true,
        isElectronic: true,
        completenessScore: true,
      },
      skip: offset,
      take: CHUNK_SIZE,
    });

    if (books.length === 0) break;

    // バッチ更新（SQLiteではトランザクション内でまとめて実行）
    await prisma.$transaction(
      books.map((book) => {
        const pubCount = book.publisherNormalized
          ? pubCountMap.get(book.publisherNormalized) || 0
          : 0;
        const { tier, score: publisherScore } = determineTier(
          book.publisher,
          book.label || book.labelNormalized,
          pubCount
        );
        const freshnessScore = calculateFreshness(book.publishedDate);
        const penalty = calculatePenalty(book.title, book.isElectronic);

        // custom_rank = publisherScore + popularityScore(0 initially) + completenessScore + freshnessScore - penalty
        const customRank =
          publisherScore +
          0 + // popularityScore: 初期は0、楽天ランキングやユーザー行動で後から更新
          book.completenessScore +
          freshnessScore +
          penalty;

        return prisma.book.update({
          where: { id: book.id },
          data: {
            publisherTier: tier,
            publisherScore,
            freshnessScore,
            customRank,
          },
        });
      })
    );

    updated += books.length;
    offset += CHUNK_SIZE;

    const pct = ((updated / totalBooks) * 100).toFixed(1);
    console.log(`  [${pct}%] Updated ${updated.toLocaleString()} / ${totalBooks.toLocaleString()}`);
  }

  // Step 3: サマリー
  console.log("\n[3/3] Summary:");
  const tierCounts = await prisma.$queryRawUnsafe<Array<{ publisherTier: string; cnt: number }>>(
    `SELECT publisherTier, COUNT(*) as cnt FROM Book GROUP BY publisherTier ORDER BY publisherTier`
  );
  for (const row of tierCounts) {
    console.log(`  ${row.publisherTier}: ${Number(row.cnt).toLocaleString()} books`);
  }

  const topBooks = await prisma.book.findMany({
    select: { title: true, author: true, publisher: true, label: true, customRank: true, publisherTier: true },
    orderBy: { customRank: "desc" },
    take: 10,
  });
  console.log("\n  Top 10 by custom_rank:");
  for (const b of topBooks) {
    console.log(`    [${b.publisherTier}|${b.customRank}] ${b.title} / ${b.author} (${b.publisher || "?"} / ${b.label || "-"})`);
  }

  await prisma.$disconnect();
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
