import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "s.taka916121@gmail.com";
  const newPassword = "Test12345!";

  const hash = await bcryptjs.hash(newPassword, 12);
  const updated = await prisma.user.update({
    where: { email },
    data: {
      passwordHash: hash,
      emailVerified: new Date(),
      image: null,
    },
  });

  console.log(`✅ パスワードリセット完了: ${email}`);
  console.log(`新パスワード: ${newPassword}`);
  console.log(`emailVerified: ${updated.emailVerified}`);
  console.log(`image: null にクリア`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
