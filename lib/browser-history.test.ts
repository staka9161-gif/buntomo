import { describe, expect, it, vi } from "vitest";
import { createHistoryTracker, historySnapshot, subscribeHistory, type HistoryBrowser } from "./browser-history";

function fixture(initialLength = 1) {
  const target = new EventTarget();
  const storage = new Map<string, string>();
  const location = { href: "http://fixture/start" };
  const entries = Array.from({ length: initialLength }, () => ({ state: { routerData: "preserved" } as Record<string, unknown> | null, url: location.href }));
  let index = initialLength - 1;
  const history = {
    get state() { return entries[index].state; },
    get length() { return entries.length; },
    pushState(data: object, _: string, url: string) { location.href = new URL(url, location.href).href; entries.splice(index + 1); entries.push({ state: data as typeof entries[0]["state"], url: location.href }); index++; },
    replaceState(data: object, _: string, url?: string) { if (url) location.href = new URL(url, location.href).href; entries[index] = { state: data as typeof entries[0]["state"], url: location.href }; },
  };
  const browser = Object.assign(target, { history, location, sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } }) as unknown as HistoryBrowser;
  const go = (delta: number) => { index += delta; location.href = entries[index].url; target.dispatchEvent(new Event("popstate")); };
  const hash = (value: string) => {
    location.href = new URL(value, location.href).href;
    entries.splice(index + 1);
    entries.push({ state: null, url: location.href }); index++;
    target.dispatchEvent(new Event("popstate"));
    target.dispatchEvent(new Event("hashchange"));
  };
  return { browser, go, hash, entries, storage };
}

describe("history tracking without Navigation API", () => {
  it("enables only real back/forward entries through push, pop, replace and branching", () => {
    const { browser, go } = fixture();
    const tracker = createHistoryTracker(browser);
    expect(tracker.snapshot()).toBe(0);
    browser.history.pushState({ custom: 1 }, "", "/one");
    expect(tracker.snapshot()).toBe(1);
    browser.history.pushState({}, "", "/two");
    expect(tracker.snapshot()).toBe(1);
    go(-1);
    expect(tracker.snapshot()).toBe(3);
    browser.history.replaceState({ custom: 2 }, "", "/replaced");
    expect(tracker.snapshot()).toBe(3);
    go(-1);
    expect(tracker.snapshot()).toBe(2);
    go(1);
    browser.history.pushState({}, "", "/branch");
    expect(tracker.snapshot()).toBe(1);
    expect(browser.history.length).toBe(3);
  });
  it("preserves existing router state and back to an earlier external entry", () => {
    const { browser } = fixture(2);
    const tracker = createHistoryTracker(browser);
    expect(browser.history.state.routerData).toBe("preserved");
    expect(tracker.snapshot()).toBe(1);
    browser.history.pushState({ custom: 42 }, "", "/one");
    expect(browser.history.state.custom).toBe(42);
  });
  it("restores the forward boundary after a reload while behind the newest entry", () => {
    const { browser, go } = fixture();
    const originalPush = browser.history.pushState;
    const originalReplace = browser.history.replaceState;
    createHistoryTracker(browser);
    browser.history.pushState({}, "", "/one");
    browser.history.pushState({}, "", "/two");
    go(-1);
    browser.history.pushState = originalPush;
    browser.history.replaceState = originalReplace;
    expect(createHistoryTracker(browser).snapshot()).toBe(3);
  });
  it("works if sessionStorage is unavailable", () => {
    const { browser, go } = fixture();
    Object.defineProperty(browser, "sessionStorage", { get: () => { throw new Error("blocked"); } });
    const tracker = createHistoryTracker(browser);
    browser.history.pushState({}, "", "/one");
    go(-1);
    expect(tracker.snapshot()).toBe(2);
  });
  it("tracks native fragment links, including a new fragment after going back", () => {
    const { browser, go, hash } = fixture();
    const tracker = createHistoryTracker(browser);
    hash("#timeline");
    expect(tracker.snapshot()).toBe(1);
    go(-1);
    expect(tracker.snapshot()).toBe(2);
    go(1);
    expect(tracker.snapshot()).toBe(1);
    go(-1);
    hash("#different");
    expect(tracker.snapshot()).toBe(1);
    expect(browser.history.length).toBe(2);
  });
  it("shares one tracker between subscribers and supports unsubscribe", () => {
    const { browser } = fixture();
    const first = vi.fn(), second = vi.fn();
    const cleanup = subscribeHistory(browser, first);
    subscribeHistory(browser, second);
    browser.history.pushState({}, "", "/one");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(historySnapshot(browser)).toBe(1);
    cleanup();
    browser.history.pushState({}, "", "/two");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
