import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, image: true },
    orderBy: { createdAt: "asc" },
  });

  console.log("=== ユーザーの image フィールドサイズ ===\n");
  for (const u of users) {
    const size = u.image ? u.image.length : 0;
    const isDataUrl = u.image?.startsWith("data:") ?? false;
    const preview = u.image ? u.image.substring(0, 60) + (u.image.length > 60 ? "..." : "") : "(null)";
    console.log(`${u.email}`);
    console.log(`  name: ${u.name}`);
    console.log(`  image size: ${size} chars (${(size / 1024).toFixed(1)} KB)`);
    console.log(`  is data URL: ${isDataUrl}`);
    console.log(`  preview: ${preview}`);
    console.log();
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
