import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  catalogVersion,
  nextPage,
  parseClassification,
  type Classification,
  type ForestEntry,
} from "./model";

export class ForestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const bookSelect = {
  id: true,
  title: true,
  author: true,
  coverImageUrl: true,
} as const;
const readingSelect = {
  id: true,
  bookId: true,
  status: true,
  currentPage: true,
  totalPages: true,
  book: { select: bookSelect },
} as const;
type Reading = Prisma.ReadingStatusGetPayload<{ select: typeof readingSelect }>;
function entry(
  reading: Reading,
  classification: Classification | null,
): ForestEntry {
  if (!reading.book || !reading.bookId)
    throw new ForestError("本が見つかりません", 404);
  return {
    bookId: reading.bookId,
    readingStatusId: reading.id,
    title: reading.book.title,
    author: reading.book.author,
    coverImageUrl: reading.book.coverImageUrl,
    currentPage: reading.currentPage,
    totalPages: reading.totalPages,
    status: reading.status,
    classification,
  };
}
function classificationOf(value: unknown): Classification | null {
  if (!value) return null;
  return parseClassification(value);
}
export async function listForest(userId: string): Promise<ForestEntry[]> {
  const [readings, metadata] = await Promise.all([
    prisma.readingStatus.findMany({
      where: {
        userId,
        status: { in: ["READING", "COMPLETED"] },
        bookId: { not: null },
      },
      select: readingSelect,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.literatureTree.findMany({ where: { userId } }),
  ]);
  const byBook = new Map(metadata.map((tree) => [tree.bookId, tree]));
  return readings
    .filter((r) => r.book && r.bookId)
    .map((r) => entry(r, classificationOf(byBook.get(r.bookId!))));
}
export async function getForestEntry(
  userId: string,
  bookId: string,
): Promise<ForestEntry> {
  const reading = await prisma.readingStatus.findFirst({
    where: { userId, bookId, status: { in: ["READING", "COMPLETED"] } },
    select: readingSelect,
  });
  if (!reading?.book)
    throw new ForestError("読みかけ・読了済みの本が見つかりません", 404);
  const tree = await prisma.literatureTree.findUnique({
    where: { userId_bookId: { userId, bookId } },
  });
  return entry(reading, classificationOf(tree));
}
export async function saveClassification(
  userId: string,
  bookId: string,
  value: unknown,
): Promise<ForestEntry> {
  const classification = parseClassification(value);
  const reading = await getForestEntry(userId, bookId);
  const data = { ...classification, genreCatalogVersion: catalogVersion };
  await prisma.literatureTree.upsert({
    where: { userId_bookId: { userId, bookId } },
    create: { userId, bookId, ...data },
    update: data,
  });
  return { ...reading, classification };
}
export function parsePageOperation(value: unknown): {
  operationId: string;
  readingStatusId: string;
  delta: number;
} {
  if (!value || typeof value !== "object")
    throw new ForestError("ページ操作が不正です");
  const input = value as Record<string, unknown>;
  if (
    typeof input.operationId !== "string" ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(input.operationId) ||
    typeof input.readingStatusId !== "string" ||
    !input.readingStatusId ||
    input.readingStatusId.length > 100 ||
    (input.delta !== 1 && input.delta !== -1)
  )
    throw new ForestError("ページ操作が不正です");
  return {
    operationId: input.operationId,
    readingStatusId: input.readingStatusId,
    delta: input.delta,
  };
}
export async function changeForestPage(
  userId: string,
  bookId: string,
  value: unknown,
): Promise<ForestEntry> {
  const { operationId, readingStatusId, delta } = parsePageOperation(value);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const reading = await tx.readingStatus.findFirst({
            where: { id: readingStatusId, userId, bookId },
            select: readingSelect,
          });
          if (!reading?.book)
            throw new ForestError("読書記録が見つかりません", 404);
          const previous = await tx.forestPageOperation.findUnique({
            where: { userId_operationId: { userId, operationId } },
          });
          if (previous) {
            if (
              previous.readingStatusId !== readingStatusId ||
              previous.delta !== delta
            )
              throw new ForestError("操作IDが別の操作に使用されています", 409);
            return;
          }
          try {
            nextPage(reading, delta);
          } catch (error) {
            throw new ForestError((error as Error).message, 409);
          }
          // Serializable isolation also conflicts with completion/total-page edits.
          await tx.readingStatus.update({
            where: { id: readingStatusId, userId, status: "READING" },
            data: { currentPage: { increment: delta } },
          });
          await tx.forestPageOperation.create({
            data: { userId, readingStatusId, operationId, delta },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return await getForestEntry(userId, bookId);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2025")
        throw new ForestError(
          "読書状態が変更されました。再読み込みしてください",
          409,
        );
      if ((code === "P2034" || code === "P2002") && attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new ForestError("保存が競合しました。再試行してください", 409);
}
