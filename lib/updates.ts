export type UpdateEntry = {
  id: string;
  date: string;
  type: "新機能" | "改善" | "修正" | "お知らせ";
  title: string;
  body: string;
  href?: string;
  topicTag?: string;
};

export const updateTypes: UpdateEntry["type"][] = ["新機能", "改善", "修正", "お知らせ"];

// ユーザーに知らせるべき新機能・改善・修正を行った場合は、
// 実装と同じタイミングで、利用者にとって何が変わったかを追加する。
export const updateTopicTags = [
  "読書会",
  "通報",
  "アカウント",
  "安全",
  "マイページ",
  "お知らせ",
] as const;

export const updates: UpdateEntry[] = [];
