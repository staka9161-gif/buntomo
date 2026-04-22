"use client";

export default function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 rounded-full bg-gray-200">
        <div
          className="h-2.5 rounded-full bg-amber-500 transition-all"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-600">{percent}%</span>
    </div>
  );
}
