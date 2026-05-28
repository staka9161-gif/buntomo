import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "読書会を探す",
  description: "全国の読書会・読書イベントを探せます。同じ本を読む仲間と出会いましょう。",
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
