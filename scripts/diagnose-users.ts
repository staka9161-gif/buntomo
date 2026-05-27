import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      passwordHash: true,
      emailVerified: true,
      createdAt: true,
      accounts: {
        select: {
          provider: true,
          providerAccountId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log("=== 全ユーザー ===");
  for (const u of users) {
    console.log({
      id: u.id,
      email: u.email,
      name: u.name,
      hasPassword: !!u.passwordHash,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      providers: u.accounts.map(a => a.provider),
    });
  }
  console.log(`\n合計: ${users.length} ユーザー`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
