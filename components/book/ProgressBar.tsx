"use client";

export default function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-[5px] flex-1 rounded-full bg-[rgb(31_42_68_/_0.08)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="font-mono text-xs font-medium text-[var(--color-accent)]">{percent}%</span>
    </div>
  );
}
