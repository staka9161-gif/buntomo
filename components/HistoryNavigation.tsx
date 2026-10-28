"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { historySnapshot, subscribeHistory } from "@/lib/browser-history";

export { historyAvailability } from "@/lib/browser-history";

function getSnapshot() {
  return historySnapshot(window);
}

function getServerSnapshot() {
  return 0;
}

function subscribe(onChange: () => void) {
  return subscribeHistory(window, onChange);
}

export default function HistoryNavigation() {
  // Also refresh availability on client route changes in History-only browsers.
  usePathname();
  const router = useRouter();
  const available = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const buttonClass =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-bg-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-35";

  return (
    <nav
      aria-label="ページの履歴"
      className="mx-auto flex w-full max-w-7xl items-center gap-1.5 px-4 pt-2"
    >
      <button
        type="button"
        aria-label="戻る"
        title="前のページに戻る"
        disabled={!(available & 1)}
        className={buttonClass}
        onClick={() => router.back()}
      >
        <FiArrowLeft aria-hidden className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="進む"
        title="次のページへ進む"
        disabled={!(available & 2)}
        className={buttonClass}
        onClick={() => router.forward()}
      >
        <FiArrowRight aria-hidden className="h-4 w-4" />
      </button>
    </nav>
  );
}
