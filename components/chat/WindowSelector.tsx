"use client";

import { WINDOW_LABELS, type WindowType } from "@/types";

interface WindowSelectorProps {
  selected: WindowType;
  onChange: (w: WindowType) => void;
}

export default function WindowSelector({ selected, onChange }: WindowSelectorProps) {
  return (
    <div className="flex gap-1">
      {(Object.entries(WINDOW_LABELS) as [WindowType, string][]).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            selected === key
              ? "bg-amber-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
