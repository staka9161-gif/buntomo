import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findBook: vi.fn(), findReadings: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  book: { findUnique: mocks.findBook }, readingStatus: { findMany: mocks.findReadings },
} }));
vi.mock("@/lib/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/block", () => ({ getBlockedUserIds: async () => new Set() }));
vi.mock("@/lib/user-display", () => ({ getDisplayNames: async () => new Map() }));

import { GET } from "./route";

describe("reading progress uses personal totals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findBook.mockResolvedValue({ id: "book", totalPages: 320 });
    mocks.findReadings.mockResolvedValue([
      { currentPage: 100, totalPages: 250, user: { id: "A", name: "A", image: null } },
      { currentPage: 80, totalPages: 320, user: { id: "B", name: "B", image: null } },
      { currentPage: 10, totalPages: null, user: { id: "C", name: "C", image: null } },
    ]);
  });

  it("calculates 100/250 as 40% without borrowing another reader's total", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "book" }) });
    const { users } = await response.json();
    expect(users.map((u: { progressPercent: number }) => u.progressPercent)).toEqual([40, 25, 0]);
  });

  it("shared metadata changes do not change individual progress", async () => {
    mocks.findBook.mockResolvedValue({ id: "book", totalPages: 1000 });
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "book" }) });
    const { users } = await response.json();
    expect(users.map((u: { progressPercent: number }) => u.progressPercent)).toEqual([40, 25, 0]);
  });
});
