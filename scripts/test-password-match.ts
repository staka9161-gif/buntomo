import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("使い方: npx tsx scripts/test-password-match.ts <email> <password>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, emailVerified: true, passwordHash: true },
  });

  if (!user) {
    console.log("❌ ユーザーが見つかりません:", email);
    return;
  }

  console.log("✓ ユーザー発見:", { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified });
  console.log("passwordHash あり:", !!user.passwordHash);

  if (!user.passwordHash) {
    console.log("❌ パスワード未設定(OAuth ユーザーの可能性)");
    return;
  }

  const isValid = await bcryptjs.compare(password, user.passwordHash);
  console.log(isValid ? "✅ パスワード一致" : "❌ パスワード不一致");
}

main().catch(console.error).finally(() => prisma.$disconnect());
