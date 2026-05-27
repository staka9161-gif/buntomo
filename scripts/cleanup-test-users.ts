import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const KEEP_EMAIL = "s.taka916121@gmail.com";

async function main() {
  const dryRun = !process.argv.includes("--execute");

  const targets = await prisma.user.findMany({
    where: { email: { not: KEEP_EMAIL } },
    select: {
      id: true,
      email: true,
      name: true,
      _count: {
        select: {
          readings: true,
          reviews: true,
          accounts: true,
          messages: true,
          dmsSent: true,
          dmsReceived: true,
          friendshipsReceived: true,
          friendshipsRequested: true,
          emailVerificationTokens: true,
          mergeSuggestionsReported: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("=== 削除対象ユーザー ===\n");
  for (const u of targets) {
    console.log(`📧 ${u.email} (${u.name})`);
    console.log(`   ID: ${u.id}`);
    console.log(`   関連レコード: readings=${u._count.readings}, reviews=${u._count.reviews}, accounts=${u._count.accounts}, messages=${u._count.messages}, dmsSent=${u._count.dmsSent}, dmsReceived=${u._count.dmsReceived}, friendsReceived=${u._count.friendshipsReceived}, friendsRequested=${u._count.friendshipsRequested}, verifyTokens=${u._count.emailVerificationTokens}, mergeSuggestions=${u._count.mergeSuggestionsReported}`);
    console.log();
  }
  console.log(`合計: ${targets.length} ユーザー削除予定`);

  if (dryRun) {
    console.log("\n[ドライラン] --execute で実際に削除します");
    return;
  }

  console.log("\n=== 削除実行中 ===");
  for (const u of targets) {
    try {
      await prisma.user.delete({ where: { id: u.id } });
      console.log(`✅ 削除: ${u.email}`);
    } catch (e) {
      console.error(`❌ 失敗: ${u.email}`, e);
    }
  }

  // 最終確認
  const remaining = await prisma.user.findMany({ select: { email: true } });
  console.log("\n=== 残ユーザー ===");
  for (const u of remaining) console.log(`  ${u.email}`);
  console.log(`合計: ${remaining.length} ユーザー`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
