import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  books: vi.fn(), edition: vi.fn(), readings: vi.fn(), events: vi.fn(), fetch: vi.fn(),
  write: vi.fn(() => { throw new Error("ISBN lookup must not write to the database"); }),
}));
vi.mock("@/lib/db", () => ({ prisma: {
  book: { findMany: mocks.books, create: mocks.write, update: mocks.write, upsert: mocks.write },
  edition: { findFirst: mocks.edition, create: mocks.write, update: mocks.write },
  readingStatus: { count: mocks.readings, create: mocks.write, update: mocks.write },
  readingEvent: { count: mocks.events },
} }));

import { GET } from "./route";
import { isbnVariants, normalizeLookupIsbn } from "@/lib/isbn";

const isbn = "9784101006024";
const isbn10 = "4101006024";
const otherIsbn = "9784101006055";
const request = (input: string) => GET(new NextRequest(`http://localhost/api/books/isbn?isbn=${encodeURIComponent(input)}`));
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const localBook = {
  id: "book-1", isbn, title: "斜陽", author: "太宰治", publisher: "新潮社",
  totalPages: 288, publishedDate: "200306", coverImageUrl: null, description: null,
};
const openBd = (value = isbn) => [{ summary: { isbn: value, title: "斜陽", author: "太宰治", publisher: "新潮社" } }];
const google = (value = isbn) => ({ items: [{ volumeInfo: {
  title: "斜陽", authors: ["太宰治"], industryIdentifiers: [{ type: "ISBN_13", identifier: value }], pageCount: 288,
} }] });
const openLibrary = () => ({ [`ISBN:${isbn}`]: {
  title: "斜陽", authors: [{ name: "太宰治" }], identifiers: { isbn_10: [isbn10] }, number_of_pages: 288,
} });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
  mocks.books.mockResolvedValue([]);
  mocks.edition.mockResolvedValue(null);
  mocks.readings.mockResolvedValue(0);
  mocks.events.mockResolvedValue(0);
  mocks.fetch.mockImplementation(async (url: URL) => {
    if (url.hostname === "api.openbd.jp") return json([null]);
    if (url.hostname === "www.googleapis.com") return json({ totalItems: 0 });
    if (url.hostname === "openlibrary.org") return json({});
    throw new Error("Unexpected source");
  });
});

afterEach(() => {
  expect(mocks.write).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("exact ISBN validation", () => {
  it.each([isbn, isbn10, "978-4-10-100602-4", "９７８－４－１０－１００６０２－４", "ISBN-13: 9784101006024", " 4 10 100602 4 "])
    ("accepts equivalent ISBN %s", input => expect(normalizeLookupIsbn(input)).toBe(isbn));
  it("accepts ISBN-10 check digit X and handles 979 without a fake ISBN-10", () => {
    expect(normalizeLookupIsbn("0-8044-2957-x")).toBe("9780804429573");
    expect(normalizeLookupIsbn("9791234567896")).toBe("9791234567896");
    expect(isbnVariants("9791234567896")).toEqual(["9791234567896"]);
  });
  it.each(["", "斜陽", "9784101006025", "4101006025", "1234567890128", "978410100602400", "https://example.com", "9784101006024/../"])
    ("rejects %s before database or network access", async input => {
      expect((await request(input)).status).toBe(400);
      expect(mocks.books).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
    });
});

describe("GET /api/books/isbn", () => {
  it("uses exact local ISBNs and existing Book IDs without external calls", async () => {
    mocks.books.mockResolvedValue([localBook]);
    mocks.readings.mockImplementation(async ({ where }) => where.status === "READING" ? 2 : 3);
    mocks.events.mockResolvedValue(1);
    const response = await request(isbn10);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ books: [{
      isbn, bookDbId: "book-1", readingCount: 2, completedCount: 3, eventCount: 1,
    }], meta: { isbn, total: 1 } });
    expect(mocks.books).toHaveBeenCalledWith(expect.objectContaining({ where: { isbn: { in: [isbn, isbn10] } } }));
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("keeps a stored ISBN-10 so existing registration reuses the same Book", async () => {
    mocks.books.mockResolvedValue([{ ...localBook, isbn: isbn10 }]);
    expect((await (await request(isbn)).json()).books[0]).toMatchObject({ isbn: isbn10, bookDbId: "book-1" });
  });

  it("prefers the exact ISBN-13 Book when both representations exist", async () => {
    mocks.books.mockResolvedValue([{ ...localBook, id: "old", isbn: isbn10 }, localBook]);
    expect((await (await request(isbn)).json()).books[0].bookDbId).toBe("book-1");
  });

  it("offers the existing Work when the matching Edition has no Book", async () => {
    mocks.edition.mockResolvedValue({ titleOnCover: "斜陽", publisher: "新潮社", pageCount: 288,
      publishedAt: null, coverImageUrl: null, work: { id: "work-1", title: "斜陽", author: "太宰治", description: null } });
    expect((await (await request(isbn)).json()).books[0]).toMatchObject({ bookDbId: null, workDbId: "work-1", isbn });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("looks up openBD by ISBN and accepts only matching identifiers", async () => {
    mocks.fetch.mockResolvedValue(json(openBd()));
    const response = await request("９７８－４－１０－１００６０２－４");
    expect(response.status).toBe(200);
    expect((await response.json()).books[0]).toMatchObject({ title: "斜陽", isbn, bookDbId: null });
    expect(new URL(mocks.fetch.mock.calls[0][0]).searchParams.get("isbn")).toBe(isbn);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects a different openBD edition and uses Google's isbn: query", async () => {
    mocks.fetch.mockImplementation(async (url: URL) => url.hostname === "api.openbd.jp"
      ? json(openBd(otherIsbn)) : json(google()));
    expect((await (await request(isbn)).json()).books[0]).toMatchObject({ isbn, totalPages: 288 });
    const url = new URL(mocks.fetch.mock.calls[1][0]);
    expect(url.searchParams.get("q")).toBe(`isbn:${isbn}`);
    expect(url.searchParams.has("langRestrict")).toBe(false);
  });

  it("does not trust a Google result without a matching ISBN", async () => {
    mocks.fetch.mockImplementation(async (url: URL) => {
      if (url.hostname === "api.openbd.jp") return json([null]);
      if (url.hostname === "www.googleapis.com") return json(google(otherIsbn));
      return json(openLibrary());
    });
    expect((await (await request(isbn)).json()).books[0]).toMatchObject({ isbn, title: "斜陽" });
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });

  it("continues to another source after an HTTP error or timeout", async () => {
    mocks.fetch.mockImplementation(async (url: URL) => {
      if (url.hostname === "api.openbd.jp") throw new DOMException("Timed out", "TimeoutError");
      if (url.hostname === "www.googleapis.com") return json({}, 429);
      return json(openLibrary());
    });
    expect((await request(isbn)).status).toBe(200);
  });

  it("distinguishes unavailable sources from a genuine empty result", async () => {
    const response = await request(isbn);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ books: [], meta: { total: 0 } });
    mocks.fetch.mockRejectedValue(new Error("Offline"));
    expect((await request(isbn)).status).toBe(503);
  });

  it("never substitutes unrelated books even if every source returns one", async () => {
    mocks.fetch.mockImplementation(async (url: URL) => {
      if (url.hostname === "api.openbd.jp") return json(openBd(otherIsbn));
      if (url.hostname === "www.googleapis.com") return json(google(otherIsbn));
      return json({ [`ISBN:${isbn}`]: { title: "別の本", identifiers: { isbn_13: [otherIsbn] } } });
    });
    expect((await (await request(isbn)).json()).books).toEqual([]);
  });
});
