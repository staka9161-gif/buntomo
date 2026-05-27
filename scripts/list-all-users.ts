import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      emailVerified: true,
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
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("=== 全ユーザー一覧 ===\n");
  for (const u of users) {
    console.log(`📧 ${u.email}`);
    console.log(`   名前: ${u.name}`);
    console.log(`   ID: ${u.id}`);
    console.log(`   登録日: ${u.createdAt.toISOString()}`);
    console.log(`   確認済: ${u.emailVerified ? "✓" : "✗"}`);
    console.log(`   readings: ${u._count.readings}, reviews: ${u._count.reviews}, accounts: ${u._count.accounts}`);
    console.log(`   messages: ${u._count.messages}, DMs(送): ${u._count.dmsSent}, DMs(受): ${u._count.dmsReceived}`);
    console.log(`   friends(received): ${u._count.friendshipsReceived}, friends(requested): ${u._count.friendshipsRequested}`);
    console.log();
  }
  console.log(`合計: ${users.length} ユーザー`);
}

main().finally(() => prisma.$disconnect());
