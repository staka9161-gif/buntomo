import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requireActiveUser: vi.fn(),
  findBook: vi.fn(),
  deleteReadings: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/active-user", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/lib/db", () => ({
  prisma: {
    book: { findUnique: mocks.findBook },
    readingStatus: { deleteMany: mocks.deleteReadings },
  },
}));

import { DELETE } from "./route";

function deleteRequest(query: string) {
  return new NextRequest(`http://localhost/api/me/readings?${query}`, {
    method: "DELETE",
  });
}

describe("DELETE /api/me/readings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.requireActiveUser.mockResolvedValue({ ok: true, userId: "user-1" });
  });

  it("ReadingStatus ID・本人・READINGの条件で1件だけ解除する", async () => {
    mocks.deleteReadings.mockResolvedValue({ count: 1 });

    const response = await DELETE(deleteRequest("readingStatusId=reading-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.deleteReadings).toHaveBeenCalledWith({
      where: {
        id: "reading-1",
        userId: "user-1",
        status: "READING",
      },
    });
    expect(mocks.findBook).not.toHaveBeenCalled();
  });

  it("対象が0件なら成功扱いにしない", async () => {
    mocks.deleteReadings.mockResolvedValue({ count: 0 });

    const response = await DELETE(deleteRequest("readingStatusId=missing"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "読みかけの記録が見つからないか、解除できません",
    });
  });

  it("bookId指定の後方互換でも0件なら成功扱いにしない", async () => {
    mocks.findBook.mockResolvedValue({ id: "book-1" });
    mocks.deleteReadings.mockResolvedValue({ count: 0 });

    const response = await DELETE(deleteRequest("bookId=book-1"));

    expect(response.status).toBe(404);
    expect(mocks.deleteReadings).toHaveBeenCalledWith({
      where: {
        bookId: "book-1",
        userId: "user-1",
        status: "READING",
      },
    });
  });

  it("未ログインでは削除処理を呼ばない", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await DELETE(deleteRequest("readingStatusId=reading-1"));

    expect(response.status).toBe(401);
    expect(mocks.deleteReadings).not.toHaveBeenCalled();
  });
});
