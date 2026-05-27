import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 既存カラムの存在確認
  const result: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'User' AND column_name IN ('displayName', 'avatarUrl', 'name', 'image')
  `);
  console.log("現在の User テーブルの該当カラム:", result.map(r => r.column_name));

  // displayName → name
  const hasDisplayName = result.some(r => r.column_name === 'displayName');
  const hasName = result.some(r => r.column_name === 'name');
  if (hasDisplayName && !hasName) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" RENAME COLUMN "displayName" TO "name"`);
    console.log("✔ displayName → name リネーム完了");
  } else if (!hasDisplayName && hasName) {
    console.log("⏭ displayName → name はスキップ（既に完了済み）");
  } else {
    console.log("⚠ displayName → name: 予期しない状態", { hasDisplayName, hasName });
  }

  // avatarUrl → image
  const hasAvatarUrl = result.some(r => r.column_name === 'avatarUrl');
  const hasImage = result.some(r => r.column_name === 'image');
  if (hasAvatarUrl && !hasImage) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" RENAME COLUMN "avatarUrl" TO "image"`);
    console.log("✔ avatarUrl → image リネーム完了");
  } else if (!hasAvatarUrl && hasImage) {
    console.log("⏭ avatarUrl → image はスキップ（既に完了済み）");
  } else {
    console.log("⚠ avatarUrl → image: 予期しない状態", { hasAvatarUrl, hasImage });
  }

  // 確認のため User テーブルの全カラムを表示
  const allColumns: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'User'
    ORDER BY ordinal_position
  `);
  console.log("\nUser テーブルの全カラム:");
  for (const col of allColumns) {
    console.log(`  ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
  }

  // User 件数
  const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "User"`) as any[];
  console.log("\nUser テーブル件数:", count[0].cnt);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
