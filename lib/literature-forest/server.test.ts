import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  active: vi.fn(),
  db: {
    readingStatus: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    literatureTree: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    forestPageOperation: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: mock.db }));
vi.mock("@/lib/auth", () => ({ auth: mock.auth }));
vi.mock("@/lib/active-user", () => ({ requireActiveUser: mock.active }));
import {
  getForestEntry,
  listForest,
  saveClassification,
  changeForestPage,
} from "./server";
import { effectiveReadPages } from "./model";
import { GET as list } from "@/app/api/me/literature-forest/route";
import { GET, PATCH } from "@/app/api/me/literature-forest/[bookId]/route";
import { POST } from "@/app/api/me/literature-forest/[bookId]/progress/route";
import { PATCH as patchReading } from "@/app/api/me/readings/[id]/route";

const book = {
  id: "book-1",
  title: "テスト本",
  author: "著者",
  coverImageUrl: null,
};
let reading: {
  id: string;
  userId: string;
  bookId: string;
  status: string;
  currentPage: number;
  totalPages: number | null;
  book: typeof book | null;
};
const meta = {
  literatureScope: "japan",
  prefectureCode: "JP-26",
  countryCode: null,
  era: "modern",
  mainGenreId: "fiction",
  subgenreIds: [],
  customGenreTags: [],
};
const context = { params: Promise.resolve({ bookId: "book-1" }) };
const request = (value: unknown) =>
  new Request("http://local/api/me/literature-forest/book-1", {
    method: "POST",
    body: JSON.stringify(value),
  });
const operation = (id = "operation-00000001", delta = 1) => ({
  readingStatusId: "reading-1",
  operationId: id,
  delta,
});
beforeEach(() => {
  vi.resetAllMocks();
  reading = {
    id: "reading-1",
    userId: "owner",
    bookId: "book-1",
    status: "READING",
    currentPage: 0,
    totalPages: 300,
    book,
  };
  const operations = new Map<
    string,
    {
      userId: string;
      operationId: string;
      readingStatusId: string;
      delta: number;
    }
  >();
  const metadata = new Map<
    string,
    typeof meta & { bookId: string; userId: string }
  >();
  mock.auth.mockResolvedValue({ user: { id: "owner" } });
  mock.active.mockResolvedValue({ ok: true, userId: "owner" });
  mock.db.readingStatus.findFirst.mockImplementation(async ({ where }) =>
    where.userId === reading.userId &&
    where.bookId === reading.bookId &&
    (!where.id || where.id === reading.id) &&
    (!where.status || where.status.in.includes(reading.status))
      ? { ...reading }
      : null,
  );
  mock.db.readingStatus.findMany.mockImplementation(async ({ where }) =>
    where.userId === reading.userId ? [{ ...reading }] : [],
  );
  mock.db.readingStatus.update.mockImplementation(async ({ where, data }) => {
    expect(where).toEqual({
      id: reading.id,
      userId: "owner",
      status: "READING",
    });
    expect(Object.keys(data)).toEqual(["currentPage"]);
    reading.currentPage += data.currentPage.increment;
    return { ...reading };
  });
  mock.db.literatureTree.findUnique.mockImplementation(
    async ({ where }) =>
      metadata.get(
        `${where.userId_bookId.userId}:${where.userId_bookId.bookId}`,
      ) || null,
  );
  mock.db.literatureTree.findMany.mockImplementation(async ({ where }) =>
    [...metadata.values()].filter((m) => m.userId === where.userId),
  );
  mock.db.literatureTree.upsert.mockImplementation(
    async ({ where, create, update }) => {
      const key = `${where.userId_bookId.userId}:${where.userId_bookId.bookId}`;
      metadata.set(key, { ...(metadata.get(key) || create), ...update });
      return metadata.get(key);
    },
  );
  mock.db.forestPageOperation.findUnique.mockImplementation(
    async ({ where }) =>
      operations.get(
        `${where.userId_operationId.userId}:${where.userId_operationId.operationId}`,
      ) || null,
  );
  mock.db.forestPageOperation.create.mockImplementation(async ({ data }) => {
    operations.set(`${data.userId}:${data.operationId}`, data);
    return data;
  });
  // Serialize the fake transactions; production enforces this with PostgreSQL Serializable.
  let queue = Promise.resolve();
  mock.db.$transaction.mockImplementation((run, options) => {
    expect(options).toEqual({ isolationLevel: "Serializable" });
    const result = queue.then(() => run(mock.db));
    queue = result.catch(() => undefined);
    return result;
  });
});
describe("forest API ownership and validation", () => {
  it("keeps the same Book's map, classification, progress and operation IDs independent for A and B", async () => {
    const other = { ...reading, id: "reading-2", userId: "other", currentPage: 70, totalPages: 500 };
    const rows = [reading, other];
    mock.db.readingStatus.findFirst.mockImplementation(async ({ where }) => {
      const row = rows.find((r) => r.userId === where.userId && r.bookId === where.bookId && (!where.id || r.id === where.id));
      return row ? { ...row } : null;
    });
    mock.db.readingStatus.findMany.mockImplementation(async ({ where }) => rows.filter((r) => r.userId === where.userId));
    mock.db.readingStatus.update.mockImplementation(async ({ where, data }) => {
      const row = rows.find((r) => r.id === where.id && r.userId === where.userId && r.status === where.status)!;
      row.currentPage += data.currentPage.increment;
      return { ...row };
    });
    await saveClassification("owner", "book-1", meta);
    await saveClassification("other", "book-1", { ...meta, prefectureCode: "JP-13", era: "2020" });
    await changeForestPage("owner", "book-1", operation());
    await changeForestPage("owner", "book-1", operation());
    await changeForestPage("other", "book-1", { ...operation(), readingStatusId: "reading-2" });
    expect((await listForest("owner"))[0]).toMatchObject({ currentPage: 1, totalPages: 300, classification: { prefectureCode: "JP-26" } });
    expect((await listForest("other"))[0]).toMatchObject({ currentPage: 71, totalPages: 500, classification: { prefectureCode: "JP-13" } });
    mock.active.mockResolvedValue({ ok: true, userId: "other" });
    expect((await POST(request({ ...operation("different-operation-0001"), userId: "owner" }), context)).status).toBe(404);
    expect(reading.currentPage).toBe(1);
  });

  it("returns 409 rather than corrupting progress when +1 commits during a total-pages PATCH", async () => {
    reading.currentPage = 100;
    mock.db.readingStatus.findUnique.mockImplementation(async () => ({ ...reading }));
    let release!: () => void;
    let reached!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { reached = resolve; });
    const increment = mock.db.readingStatus.update.getMockImplementation()!;
    mock.db.readingStatus.update.mockImplementation(async (args) => {
      if ("totalPages" in args.data) {
        reached();
        await gate;
        expect(args.where).toMatchObject({ userId: "owner", currentPage: 100, totalPages: 300, status: "READING" });
        if (reading.currentPage !== args.where.currentPage || reading.totalPages !== args.where.totalPages)
          throw Object.assign(new Error("Concurrent update"), { code: "P2025" });
        reading.totalPages = args.data.totalPages;
        return { ...reading };
      }
      return increment(args);
    });
    const pending = patchReading(request({ totalPages: 100 }) as Parameters<typeof patchReading>[0], { params: Promise.resolve({ id: reading.id }) });
    await entered;
    await changeForestPage("owner", "book-1", operation());
    release();
    expect((await pending).status).toBe(409);
    expect(reading).toMatchObject({ currentPage: 101, totalPages: 300 });
  });

  it("requires authentication for reads and active users for writes", async () => {
    mock.auth.mockResolvedValue(null);
    expect((await list()).status).toBe(401);
    expect((await GET(request({}), context)).status).toBe(401);
    mock.active.mockResolvedValue({ ok: false, status: 403, error: "停止中" });
    expect((await POST(request(operation()), context)).status).toBe(403);
    expect((await PATCH(request(meta), context)).status).toBe(403);
    expect(mock.db.$transaction).not.toHaveBeenCalled();
    expect(mock.db.literatureTree.upsert).not.toHaveBeenCalled();
  });
  it("cannot read or write another user's tree or progress", async () => {
    mock.auth.mockResolvedValue({ user: { id: "other" } });
    mock.active.mockResolvedValue({ ok: true, userId: "other" });
    expect(await (await list()).json()).toEqual({ trees: [] });
    expect((await GET(request({}), context)).status).toBe(404);
    expect(
      (await POST(request({ ...operation(), userId: "owner" }), context))
        .status,
    ).toBe(404);
    expect(
      (await PATCH(request({ ...meta, userId: "owner" }), context)).status,
    ).toBe(404);
    expect(mock.db.readingStatus.update).not.toHaveBeenCalled();
  });
  it("validates input before writes and returns private no-store responses", async () => {
    expect(
      (await PATCH(request({ ...meta, subgenreIds: ["invalid"] }), context))
        .status,
    ).toBe(400);
    expect(
      (await POST(request({ ...operation(), delta: 999 }), context)).status,
    ).toBe(400);
    const result = await GET(request({}), context);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mock.db.readingStatus.update).not.toHaveBeenCalled();
  });
});
describe("derived trees and idempotent classification", () => {
  it("persists the exact selected year without changing reading progress", async () => {
    await saveClassification("owner", "book-1", { ...meta, era: "1948" });
    expect((await getForestEntry("owner", "book-1")).classification?.era).toBe(
      "1948",
    );
    expect(mock.db.readingStatus.update).not.toHaveBeenCalled();
    expect(mock.db.literatureTree.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ era: "1948" }),
      }),
    );
  });
  it("includes old completed books without backfill writes and skips book:null", async () => {
    reading.status = "COMPLETED";
    const trees = await listForest("owner");
    expect(trees).toHaveLength(1);
    expect(trees[0].classification).toBeNull();
    expect(effectiveReadPages(trees[0])).toBe(300);
    expect(mock.db.literatureTree.upsert).not.toHaveBeenCalled();
    reading.book = null;
    expect(await listForest("owner")).toEqual([]);
  });
  it("keeps one tree per owner/book when genre or location changes", async () => {
    await saveClassification("owner", "book-1", meta);
    await saveClassification("owner", "book-1", {
      ...meta,
      prefectureCode: "JP-13",
      mainGenreId: "business",
    });
    const trees = await listForest("owner");
    expect(trees).toHaveLength(1);
    expect(trees[0].classification?.prefectureCode).toBe("JP-13");
    expect(reading.currentPage).toBe(0);
    expect(reading.status).toBe("READING");
    expect(mock.db.readingStatus.update).not.toHaveBeenCalled();
  });
  it("shows changed total and completion immediately without cumulative growth", async () => {
    reading.currentPage = 100;
    reading.status = "COMPLETED";
    expect(effectiveReadPages(await getForestEntry("owner", "book-1"))).toBe(
      300,
    );
    reading.totalPages = 320;
    expect(effectiveReadPages(await getForestEntry("owner", "book-1"))).toBe(
      320,
    );
    reading.status = "READING";
    expect(effectiveReadPages(await getForestEntry("owner", "book-1"))).toBe(
      100,
    );
  });
});
describe("page operations", () => {
  it("same operation retry is applied once; different devices do not lose increments", async () => {
    await Promise.all([
      changeForestPage("owner", "book-1", operation()),
      changeForestPage("owner", "book-1", operation()),
    ]);
    expect(reading.currentPage).toBe(1);
    await Promise.all([
      changeForestPage("owner", "book-1", operation("operation-device02")),
      changeForestPage("owner", "book-1", operation("operation-device03")),
    ]);
    expect(reading.currentPage).toBe(3);
    expect(mock.db.readingStatus.update).toHaveBeenCalledTimes(3);
    await changeForestPage(
      "owner",
      "book-1",
      operation("operation-undo0001", -1),
    );
    expect(reading.currentPage).toBe(2);
  });
  it("rejects reused operation IDs with a different delta", async () => {
    await changeForestPage("owner", "book-1", operation());
    await expect(
      changeForestPage("owner", "book-1", operation(undefined, -1)),
    ).rejects.toMatchObject({ status: 409 });
    expect(reading.currentPage).toBe(1);
  });
  it("rejects bounds and completed records without any mutation", async () => {
    expect(
      (await POST(request(operation(undefined, -1)), context)).status,
    ).toBe(409);
    reading.currentPage = 300;
    expect((await POST(request(operation()), context)).status).toBe(409);
    reading.status = "COMPLETED";
    expect(
      (await POST(request(operation(undefined, -1)), context)).status,
    ).toBe(409);
    expect(mock.db.readingStatus.update).not.toHaveBeenCalled();
    expect(mock.db.forestPageOperation.create).not.toHaveBeenCalled();
  });
  it("retries serialization/unique conflicts using the same operation", async () => {
    mock.db.$transaction
      .mockRejectedValueOnce({ code: "P2034" })
      .mockRejectedValueOnce({ code: "P2002" });
    const response = await POST(request(operation()), context);
    expect(response.status).toBe(200);
    expect(reading.currentPage).toBe(1);
    expect(mock.db.$transaction).toHaveBeenCalledTimes(3);
  });
  it("does not update book, work, edition, review, totalPages or completion", async () => {
    await changeForestPage("owner", "book-1", operation());
    expect(reading).toMatchObject({ totalPages: 300, status: "READING", book });
    expect(mock.db.readingStatus.update).toHaveBeenCalledWith({
      where: { id: "reading-1", userId: "owner", status: "READING" },
      data: { currentPage: { increment: 1 } },
    });
  });
  it("returns a conflict when completion/removal races with the tap", async () => {
    mock.db.$transaction.mockRejectedValueOnce({ code: "P2025" });
    const response = await POST(request(operation()), context);
    expect(response.status).toBe(409);
    expect(mock.db.readingStatus.update).not.toHaveBeenCalled();
  });
});
