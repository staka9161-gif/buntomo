import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const target = "tsaukgaa@gmail.com";
  const dryRun = !process.argv.includes("--execute");

  const user = await prisma.user.findUnique({
    where: { email: target },
    include: {
      accounts: true,
      readings: true,
      messages: true,
      reviews: true,
      readingEvents: true,
      passwordResetTokens: true,
      friendshipsRequested: true,
      friendshipsReceived: true,
      dmsSent: true,
      dmsReceived: true,
      blockedUsers: true,
      blockedByUsers: true,
      mergeSuggestionsReported: true,
    },
  });

  if (!user) {
    console.log("ユーザーが見つかりません:", target);
    return;
  }

  console.log("対象ユーザー:", user.id, user.email, user.name);
  console.log("関連レコード:");
  console.log("  accounts:", user.accounts.length);
  console.log("  readings:", user.readings.length);
  console.log("  messages:", user.messages.length);
  console.log("  reviews:", user.reviews.length);
  console.log("  readingEvents:", user.readingEvents.length);
  console.log("  passwordResetTokens:", user.passwordResetTokens.length);
  console.log("  friendshipsRequested:", user.friendshipsRequested.length);
  console.log("  friendshipsReceived:", user.friendshipsReceived.length);
  console.log("  dmsSent:", user.dmsSent.length);
  console.log("  dmsReceived:", user.dmsReceived.length);
  console.log("  blockedUsers:", user.blockedUsers.length);
  console.log("  blockedByUsers:", user.blockedByUsers.length);
  console.log("  mergeSuggestionsReported:", user.mergeSuggestionsReported.length);

  if (dryRun) {
    console.log("\n[ドライラン] 削除は実行しません。実際に削除するには --execute フラグを付けてください。");
    return;
  }

  // 実際の削除（--execute 時のみ）
  console.log("\n削除を実行します...");
  await prisma.account.deleteMany({ where: { userId: user.id } });
  console.log("  Account 削除完了");
  await prisma.user.delete({ where: { id: user.id } });
  console.log("  User 削除完了");
  console.log("完了:", target, "を削除しました");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
