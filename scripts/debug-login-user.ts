import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  for (const u of users) {
    console.log({
      email: u.email,
      emailVerified: u.emailVerified,
      hasPassword: !!u.passwordHash,
      providers: u.accounts.map(a => a.provider),
    });
  }
}

main().finally(() => prisma.$disconnect());
