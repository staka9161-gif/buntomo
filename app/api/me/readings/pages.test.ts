import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), activeUser: vi.fn(),
  findBook: vi.fn(), updateBook: vi.fn(), deleteBook: vi.fn(),
  findReading: vi.fn(), createReading: vi.fn(), updateReading: vi.fn(), deleteReadings: vi.fn(),
  findReadings: vi.fn(), groupReadings: vi.fn(), findWorks: vi.fn(), findEvents: vi.fn(),
  updateWork: vi.fn(), deleteWork: vi.fn(), updateEdition: vi.fn(), deleteEdition: vi.fn(),
  updateReview: vi.fn(), deleteReview: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/active-user", () => ({ requireActiveUser: mocks.activeUser }));
vi.mock("@/lib/db", () => ({ prisma: {
  book: { findUnique: mocks.findBook, update: mocks.updateBook, delete: mocks.deleteBook },
  readingStatus: {
    findUnique: mocks.findReading, create: mocks.createReading, update: mocks.updateReading,
    deleteMany: mocks.deleteReadings, findMany: mocks.findReadings, groupBy: mocks.groupReadings,
  },
  work: { findMany: mocks.findWorks, update: mocks.updateWork, delete: mocks.deleteWork },
  edition: { update: mocks.updateEdition, delete: mocks.deleteEdition },
  review: { update: mocks.updateReview, delete: mocks.deleteReview },
  readingEvent: { findMany: mocks.findEvents },
} }));

import { POST, GET, DELETE } from "./route";
import { PATCH } from "./[id]/route";
import { PATCH as patchSharedBook } from "../../books/[id]/route";

interface Reading {
  id: string;
  userId: string;
  bookId: string | null;
  status: string;
  currentPage: number;
  totalPages: number | null;
  completedAt?: Date | null;
  startedAt?: Date | null;
}

let readings: Map<string, Reading>;
let books: Map<string, { id: string; totalPages: number }>;

function login(userId: string) {
  mocks.auth.mockResolvedValue({ user: { id: userId } });
  mocks.activeUser.mockResolvedValue({ ok: true, userId });
}

function request(method: string, body: unknown) {
  return new NextRequest("http://localhost/api/me/readings", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

async function create(userId: string, bookId = "known", extra = {}) {
  login(userId);
  const response = await POST(request("POST", { bookId, status: "READING", ...extra }));
  expect(response.status).toBe(201);
  return (await response.json()).reading as Reading;
}

function patch(id: string, body: unknown) {
  return PATCH(request("PATCH", body), { params: Promise.resolve({ id }) });
}

describe("personal reading page counts (mock database only)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    readings = new Map();
    books = new Map([
      ["known", { id: "known", totalPages: 320 }],
      ["unknown", { id: "unknown", totalPages: 0 }],
    ]);
    login("A");
    mocks.findBook.mockImplementation(async ({ where }) => books.get(where.id) ?? null);
    mocks.findReading.mockImplementation(async ({ where }) => {
      const found = where.id ? readings.get(where.id) : [...readings.values()].find(r =>
        r.userId === where.userId_bookId.userId && r.bookId === where.userId_bookId.bookId);
      return found ? { ...found } : null;
    });
    mocks.createReading.mockImplementation(async ({ data }: { data: Omit<Reading, "id" | "currentPage"> }) => {
      const reading = { id: `reading-${readings.size + 1}`, currentPage: 0, ...data };
      readings.set(reading.id, reading);
      return { ...reading };
    });
    mocks.updateReading.mockImplementation(async ({ where, data }: {
      where: { id: string; userId: string }; data: Partial<Reading>;
    }) => {
      const reading = readings.get(where.id);
      if (!reading || reading.userId !== where.userId) throw new Error("Missing owner constraint");
      Object.assign(reading, data);
      return { ...reading };
    });
    mocks.deleteReadings.mockImplementation(async ({ where }) => {
      const reading = readings.get(where.id);
      if (!reading || reading.userId !== where.userId || reading.status !== where.status) return { count: 0 };
      readings.delete(reading.id);
      return { count: 1 };
    });
    mocks.findReadings.mockImplementation(async ({ where }) => [...readings.values()]
      .filter(r => r.userId === where.userId)
      .map(r => ({ ...r, book: r.bookId ? books.get(r.bookId) : null, edition: null })));
    mocks.findWorks.mockResolvedValue([]);
    mocks.groupReadings.mockResolvedValue([]);
    mocks.findEvents.mockResolvedValue([]);
  });

  afterEach(() => {
    for (const mutation of [mocks.updateBook, mocks.deleteBook, mocks.updateWork, mocks.deleteWork,
      mocks.updateEdition, mocks.deleteEdition, mocks.updateReview, mocks.deleteReview]) {
      expect(mutation).not.toHaveBeenCalled();
    }
  });

  it("copies metadata once and keeps A, B and Book independent", async () => {
    const a = await create("A");
    const b = await create("B");
    expect([a.totalPages, b.totalPages]).toEqual([320, 320]);
    login("A");
    expect((await patch(a.id, { currentPage: 120, totalPages: 310 })).status).toBe(200);
    expect([readings.get(a.id)?.totalPages, readings.get(b.id)?.totalPages, books.get("known")?.totalPages])
      .toEqual([310, 320, 320]);
    login("B");
    expect((await patch(b.id, { currentPage: 80, totalPages: 300 })).status).toBe(200);
    expect([readings.get(a.id)?.totalPages, readings.get(b.id)?.totalPages, books.get("known")?.totalPages])
      .toEqual([310, 300, 320]);
    expect(readings.get(a.id)?.currentPage).toBe(120);
    expect(readings.get(b.id)?.currentPage).toBe(80);
    expect(mocks.updateReading).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: b.id, userId: "B" } }));
  });

  it("unknown metadata stays 0 and never inherits A's manual 280 for B", async () => {
    const a = await create("A", "unknown");
    expect(a.totalPages).toBeNull();
    expect((await patch(a.id, { totalPages: 280 })).status).toBe(200);
    const b = await create("B", "unknown");
    expect([readings.get(a.id)?.totalPages, b.totalPages, books.get("unknown")?.totalPages]).toEqual([280, null, 0]);
  });

  it("manual total during registration is personal only", async () => {
    const a = await create("A", "unknown", { totalPages: 280 });
    const b = await create("B", "unknown");
    expect([a.totalPages, b.totalPages, books.get("unknown")?.totalPages]).toEqual([280, null, 0]);
  });

  it("GET returns personal values and preserves the book:null safeguard", async () => {
    const a = await create("A");
    await patch(a.id, { totalPages: 310 });
    readings.set("legacy", { ...a, id: "legacy", bookId: null });
    const response = await GET(new NextRequest("http://localhost/api/me/readings"));
    const data = await response.json();
    expect(data.readings).toHaveLength(1);
    expect(data.readings[0]).toMatchObject({ totalPages: 310, book: { totalPages: 320 } });
  });

  it("completion, completion-date editing and reverting preserve personal total", async () => {
    const a = await create("A");
    await patch(a.id, { totalPages: 310 });
    expect((await patch(a.id, { status: "COMPLETED" })).status).toBe(200);
    expect(readings.get(a.id)?.totalPages).toBe(310);
    expect((await patch(a.id, { completedAt: "2026-09-18" })).status).toBe(200);
    expect(readings.get(a.id)?.totalPages).toBe(310);
    expect((await patch(a.id, { status: "READING" })).status).toBe(200);
    expect(readings.get(a.id)?.totalPages).toBe(310);
  });

  it("does not overwrite a personal value on duplicate registration", async () => {
    const a = await create("A");
    await patch(a.id, { totalPages: 310 });
    const response = await POST(request("POST", { bookId: "known", status: "READING" }));
    expect(response.status).toBe(409);
    expect(readings.get(a.id)?.totalPages).toBe(310);
  });

  it("rejects another user's record and missing IDs", async () => {
    const a = await create("A");
    login("B");
    expect((await patch(a.id, { totalPages: 300 })).status).toBe(404);
    expect((await patch("missing", { totalPages: 300 })).status).toBe(404);
    expect(mocks.updateReading).not.toHaveBeenCalled();
  });

  it.each([null, 0, -1, 1.5, "300", true, 100001])("rejects invalid total %j on POST and PATCH", async (value) => {
    const a = await create("A");
    expect((await patch(a.id, { totalPages: value })).status).toBe(400);
    expect((await POST(request("POST", { bookId: "unknown", status: "READING", totalPages: value }))).status).toBe(400);
    expect(readings.get(a.id)?.totalPages).toBe(320);
    expect(mocks.updateReading).not.toHaveBeenCalled();
  });

  it.each([null, -1, 1.5, "100", true, 100001])("rejects invalid current page %j", async (value) => {
    const a = await create("A");
    expect((await patch(a.id, { currentPage: value })).status).toBe(400);
    expect(mocks.updateReading).not.toHaveBeenCalled();
  });

  it("rejects current > total and accepts an atomic increase of both", async () => {
    const a = await create("A");
    expect((await patch(a.id, { currentPage: 321 })).status).toBe(400);
    expect((await patch(a.id, { currentPage: 120 })).status).toBe(200);
    expect((await patch(a.id, { totalPages: 100 })).status).toBe(400);
    expect((await patch(a.id, { currentPage: 350, totalPages: 400 })).status).toBe(200);
    expect(readings.get(a.id)).toMatchObject({ currentPage: 350, totalPages: 400 });
  });

  it("allows current-page updates when personal total is unknown", async () => {
    const a = await create("A", "unknown");
    expect((await patch(a.id, { currentPage: 10 })).status).toBe(200);
    expect(readings.get(a.id)).toMatchObject({ currentPage: 10, totalPages: null });
  });

  it("retains authorization and active-user restrictions", async () => {
    const a = await create("A");
    mocks.auth.mockResolvedValue(null);
    expect((await patch(a.id, { totalPages: 300 })).status).toBe(401);
    expect((await POST(request("POST", { bookId: "unknown", status: "READING" }))).status).toBe(401);
    login("A");
    mocks.activeUser.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });
    expect((await patch(a.id, { totalPages: 300 })).status).toBe(403);
    expect((await POST(request("POST", { bookId: "unknown", status: "READING" }))).status).toBe(403);
    expect(mocks.updateReading).not.toHaveBeenCalled();
  });

  it("disables the old shared Book PATCH even for authenticated users", async () => {
    expect((await patchSharedBook()).status).toBe(405);
    expect(mocks.updateReading).not.toHaveBeenCalled();
  });

  it("removing a reading leaves the other user's reading and metadata intact", async () => {
    const a = await create("A", "known", { totalPages: 310 });
    const b = await create("B");
    login("A");
    const response = await DELETE(new NextRequest(`http://localhost/api/me/readings?readingStatusId=${a.id}`, { method: "DELETE" }));
    expect(response.status).toBe(200);
    expect(readings.has(a.id)).toBe(false);
    expect(readings.get(b.id)?.totalPages).toBe(320);
    expect(books.get("known")?.totalPages).toBe(320);
  });
});
