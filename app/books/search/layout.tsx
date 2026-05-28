import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "本を探す",
  description: "読みたい本を検索して、読書記録に追加できます。",
};

export default function BookSearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
