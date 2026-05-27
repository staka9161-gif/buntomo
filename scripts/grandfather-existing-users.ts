import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const dryRun = !process.argv.includes("--execute");

  // 現状の確認
  const totalUsers = await prisma.user.count();
  const verifiedCount = await prisma.user.count({ where: { emailVerified: { not: null } } });
  const unverifiedCount = await prisma.user.count({ where: { emailVerified: null } });

  console.log("=== 実行前の状態 ===");
  console.log(`全ユーザー数: ${totalUsers}`);
  console.log(`確認済み: ${verifiedCount}`);
  console.log(`未確認: ${unverifiedCount}`);

  // 未確認ユーザー一覧
  const unverified = await prisma.user.findMany({
    where: { emailVerified: null },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (unverified.length === 0) {
    console.log("\n未確認ユーザーはいません。何もしません。");
    return;
  }

  console.log("\n対象ユーザー:");
  for (const u of unverified) {
    console.log(`  ${u.email} (${u.name}) - 作成日: ${u.createdAt.toISOString()}`);
  }

  if (dryRun) {
    console.log(`\n[ドライラン] ${unverified.length} 件のユーザーを確認済みに更新予定。`);
    console.log("実際に更新するには --execute フラグを付けてください。");
    return;
  }

  // 実行
  const now = new Date();
  const result = await prisma.user.updateMany({
    where: { emailVerified: null },
    data: { emailVerified: now },
  });

  console.log(`\n${result.count} 件のユーザーを確認済みに更新しました。(emailVerified = ${now.toISOString()})`);

  // 実行後の確認
  const afterVerified = await prisma.user.count({ where: { emailVerified: { not: null } } });
  const afterUnverified = await prisma.user.count({ where: { emailVerified: null } });
  console.log("\n=== 実行後の状態 ===");
  console.log(`確認済み: ${afterVerified}`);
  console.log(`未確認: ${afterUnverified}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
