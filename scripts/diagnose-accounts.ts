import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      provider: true,
      providerAccountId: true,
      type: true,
      userId: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });
  console.log("=== 全 Account レコード ===");
  for (const a of accounts) {
    console.log({
      id: a.id,
      provider: a.provider,
      providerAccountId: a.providerAccountId,
      type: a.type,
      userId: a.userId,
      userEmail: a.user.email,
      userName: a.user.name,
    });
  }
  console.log(`\n合計: ${accounts.length} Account`);

  // 各ユーザーに紐付く Account 数も確認
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      _count: { select: { accounts: true } },
    },
  });
  console.log("\n=== ユーザーごとの Account 数 ===");
  for (const u of users) {
    console.log(`${u.email}: ${u._count.accounts} account(s)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
