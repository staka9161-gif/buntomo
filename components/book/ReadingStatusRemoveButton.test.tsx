import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ReadingStatusRemoveButton, {
  CONFIRM_MESSAGE,
  ReadingStatusRemovalConfirmation,
  createInFlightGuard,
  removeReadingStatus,
} from "./ReadingStatusRemoveButton";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ReadingStatusRemoveButton", () => {
  it("ReadingStatus IDがある解除ボタンをtype=buttonで表示する", () => {
    const markup = renderToStaticMarkup(
      <ReadingStatusRemoveButton
        readingStatusId="reading-1"
        bookTitle="テスト本"
      />
    );

    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-label="テスト本を読みかけから解除"');
    expect(markup).not.toMatch(/<button[^>]*\sdisabled(?:=|>)/);
  });

  it("解除ボタンをLinkの内側に描画しない", () => {
    const markup = renderToStaticMarkup(
      <ReadingStatusRemoveButton readingStatusId="reading-1" />
    );

    expect(markup).toContain("読みかけを解除");
    expect(markup).not.toContain("<a");
  });

  it("解除前の確認ダイアログに確認文言と操作ボタンを表示する", () => {
    const markup = renderToStaticMarkup(
      <ReadingStatusRemovalConfirmation
        isRemoving={false}
        error={null}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain(CONFIRM_MESSAGE);
    expect(markup).toContain("解除する");
    expect(markup).toContain("キャンセル");
  });

  it("解除中は確認ダイアログの操作ボタンを無効にする", () => {
    const markup = renderToStaticMarkup(
      <ReadingStatusRemovalConfirmation
        isRemoving
        error={null}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(markup.match(/ disabled=""/g)).toHaveLength(2);
    expect(markup).toContain("解除中...");
  });

  it("ReadingStatus IDを含むURLへDELETEを送る", async () => {
    const request = vi.fn(async () => jsonResponse({ ok: true }));

    await removeReadingStatus({
      readingStatusId: "reading id/1",
      request,
    });

    expect(request).toHaveBeenCalledWith(
      "/api/me/readings?readingStatusId=reading%20id%2F1",
      { method: "DELETE" }
    );
  });

  it("API成功時だけonRemovedを呼ぶ", async () => {
    const onRemoved = vi.fn();

    await removeReadingStatus({
      readingStatusId: "reading-1",
      request: async () => jsonResponse({ ok: true }),
      onRemoved,
    });

    expect(onRemoved).toHaveBeenCalledWith("reading-1");
  });

  it("404時はonRemovedを呼ばずAPIエラーを返す", async () => {
    const onRemoved = vi.fn();

    await expect(
      removeReadingStatus({
        readingStatusId: "missing",
        request: async () => jsonResponse({ error: "解除対象がありません" }, 404),
        onRemoved,
      })
    ).rejects.toThrow("解除対象がありません");

    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("エラーレスポンスがJSONでなくても既定エラーを返す", async () => {
    await expect(
      removeReadingStatus({
        readingStatusId: "reading-1",
        request: async () => new Response(null, { status: 500 }),
      })
    ).rejects.toThrow("読みかけを解除できませんでした。");
  });

  it("ReadingStatus IDが空ならfetchを実行しない", async () => {
    const request = vi.fn(async () => jsonResponse({ ok: true }));

    await expect(
      removeReadingStatus({ readingStatusId: "  ", request })
    ).rejects.toThrow("読書状態を再取得してから、もう一度お試しください。");

    expect(request).not.toHaveBeenCalled();
  });

  it("解除中の二重実行を拒否し、完了後は再実行可能にする", () => {
    const guard = createInFlightGuard();

    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);
    guard.finish();
    expect(guard.tryStart()).toBe(true);
  });
});
