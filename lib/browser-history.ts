type Availability = { canGoBack: boolean; canGoForward: boolean };
export type HistoryBrowser = Pick<Window, "history" | "location" | "sessionStorage" | "addEventListener" | "removeEventListener"> & {
  navigation?: Availability & EventTarget;
};
type Entry = { id: string; index: number; hasEarlierEntries: boolean };
const entryKey = "__buntomoHistory";
const storageKey = "buntomo:history:v1";

export function historyAvailability(historyLength: number, navigation?: Availability) {
  if (navigation)
    return (navigation.canGoBack ? 1 : 0) | (navigation.canGoForward ? 2 : 0);
  // History length alone never proves that a forward entry exists.
  return historyLength > 1 ? 1 : 0;
}

function entryOf(state: unknown): Entry | null {
  const entry = state && typeof state === "object" && entryKey in state ? state[entryKey] : null;
  if (!entry || typeof entry !== "object" || !("id" in entry) || !("index" in entry) || !("hasEarlierEntries" in entry)) return null;
  return typeof entry.id === "string" && Number.isSafeInteger(entry.index) && (entry.index as number) >= 0 && typeof entry.hasEarlierEntries === "boolean"
    ? entry as Entry : null;
}

export function createHistoryTracker(browser: HistoryBrowser) {
  const history = browser.history;
  const push = history.pushState;
  const replace = history.replaceState;
  const listeners = new Set<() => void>();
  let href = browser.location.href;
  let current: Entry = entryOf(history.state) || { id: crypto.randomUUID(), index: 0, hasEarlierEntries: history.length > 1 };
  let lastIndex = current.index;
  try {
    const stored = JSON.parse(browser.sessionStorage.getItem(storageKey) || "null");
    if (stored?.id === current.id && Number.isSafeInteger(stored.lastIndex) && stored.lastIndex >= current.index)
      lastIndex = stored.lastIndex;
  } catch { /* History still works without storage. */ }
  const withEntry = (data: unknown, entry: Entry) => ({
    ...(data && typeof data === "object" ? data : {}),
    [entryKey]: entry,
  });
  const persist = () => {
    try { browser.sessionStorage.setItem(storageKey, JSON.stringify({ id: current.id, lastIndex })); }
    catch { /* Optional refresh recovery. */ }
  };
  const changed = () => { persist(); listeners.forEach(listener => listener()); };
  replace.call(history, withEntry(history.state, current), "");
  persist();

  // Preserve router state and observe only public History APIs plus our own key.
  history.pushState = function (data, unused, url) {
    const next = { ...current, index: current.index + 1 };
    push.call(this, withEntry(data, next), unused, url);
    current = next;
    lastIndex = next.index;
    href = browser.location.href;
    changed();
  };
  history.replaceState = function (data, unused, url) {
    replace.call(this, withEntry(data, current), unused, url);
    href = browser.location.href;
    changed();
  };
  const traverse = () => {
    const entry = entryOf(history.state);
    const nextHref = browser.location.href;
    const before = new URL(href), after = new URL(nextHref);
    const changedHash = before.hash !== after.hash;
    before.hash = after.hash = "";
    if (entry?.id === current.id && entry.index !== current.index) current = entry;
    else if (changedHash && before.href === after.href) {
      // Native fragment links create entries without calling pushState.
      current = { ...current, index: current.index + 1 };
      lastIndex = current.index;
      replace.call(history, withEntry(history.state, current), "");
    }
    else if (entry?.id === current.id) current = entry;
    else {
      current = { id: crypto.randomUUID(), index: 0, hasEarlierEntries: history.length > 1 };
      lastIndex = 0;
      replace.call(history, withEntry(history.state, current), "");
    }
    href = nextHref;
    changed();
  };
  browser.addEventListener("popstate", traverse);
  browser.addEventListener("hashchange", traverse);
  browser.addEventListener("pageshow", traverse);
  return {
    snapshot: () => (current.hasEarlierEntries || current.index > 0 ? 1 : 0) | (current.index < lastIndex ? 2 : 0),
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

const trackers = new WeakMap<HistoryBrowser, ReturnType<typeof createHistoryTracker>>();
export function historySnapshot(browser: HistoryBrowser) {
  return browser.navigation ? historyAvailability(browser.history.length, browser.navigation)
    : trackers.get(browser)?.snapshot() ?? historyAvailability(browser.history.length);
}
export function subscribeHistory(browser: HistoryBrowser, listener: () => void) {
  if (!browser.navigation) {
    let tracker = trackers.get(browser);
    if (!tracker) { tracker = createHistoryTracker(browser); trackers.set(browser, tracker); }
    return tracker.subscribe(listener);
  }
  browser.addEventListener("popstate", listener);
  browser.addEventListener("pageshow", listener);
  browser.navigation.addEventListener("currententrychange", listener);
  return () => {
    browser.removeEventListener("popstate", listener);
    browser.removeEventListener("pageshow", listener);
    browser.navigation?.removeEventListener("currententrychange", listener);
  };
}
