import { prisma } from "@/lib/db";

export async function getDisplayName(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user?.name) return null;
  const sameName = await prisma.user.findMany({
    where: { name: user.name },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (sameName.length <= 1) return user.name;
  const index = sameName.findIndex((u) => u.id === userId);
  return `${user.name} #${index + 1}`;
}

export async function getDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const uniqueNames = Array.from(new Set(users.map((u) => u.name).filter(Boolean) as string[]));
  const nameToIds = new Map<string, string[]>();
  for (const name of uniqueNames) {
    const list = await prisma.user.findMany({
      where: { name },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    nameToIds.set(name, list.map((u) => u.id));
  }
  const result = new Map<string, string>();
  for (const u of users) {
    if (!u.name) { result.set(u.id, ""); continue; }
    const ids = nameToIds.get(u.name)!;
    if (ids.length <= 1) {
      result.set(u.id, u.name);
    } else {
      result.set(u.id, `${u.name} #${ids.indexOf(u.id) + 1}`);
    }
  }
  return result;
}
