export type UpdateEntry = {
  id: string;
  date: string;
  type: "新機能" | "改善" | "修正" | "お知らせ";
  title: string;
  body: string;
  href?: string;
};

// ユーザーに知らせるべき新機能・改善・修正を行った場合は、
// 実装と同じタイミングで、利用者にとって何が変わったかを追加する。
export const updates: UpdateEntry[] = [
  {
    id: "report-direct-messages-2026-06-16",
    date: "2026-06-16",
    type: "改善",
    title: "DMの通報に対応しました",
    body: "ダイレクトメッセージで不適切な内容を受け取った場合に、運営へ知らせられるようになりました。",
    href: "/updates",
  },
  {
    id: "clarify-report-handling-policy-2026-06-16",
    date: "2026-06-16",
    type: "お知らせ",
    title: "通報対応に関する説明を追記しました",
    body: "通報があった場合に、運営が安全確保のため必要な範囲で内容を確認することがある旨を、利用規約とプライバシーポリシーに追記しました。",
    href: "/updates",
  },
  {
    id: "report-reviews-events-2026-06-16",
    date: "2026-06-16",
    type: "改善",
    title: "レビューと読書会の通報に対応しました",
    body: "公共の目に触れるレビューや読書会について、不適切な内容が気になる場合に運営へ知らせられるようになりました。",
    href: "/updates",
  },
  {
    id: "report-chat-messages-2026-06-16",
    date: "2026-06-16",
    type: "改善",
    title: "チャットの通報に対応しました",
    body: "公共の目に触れるチャット投稿について、不適切な内容が気になる場合に運営へ知らせられるようになりました。",
    href: "/updates",
  },
  {
    id: "report-user-profiles-2026-06-16",
    date: "2026-06-16",
    type: "新機能",
    title: "プロフィールを通報できるようにしました",
    body: "不適切なプロフィールや迷惑行為が気になる場合に、運営へ知らせられるようになりました。安心して使える環境づくりに役立てていきます。",
    href: "/updates",
  },
  {
    id: "completed-page-improvements",
    date: "2026-06-16",
    type: "改善",
    title: "読了ページを見やすくしました",
    body: "読了日順の並び替え、年ごとの冊数表示、読了日の変更に対応しました。読書の記録をふりかえりやすくなりました。",
    href: "/mypage/completed",
  },
  {
    id: "book-rankings",
    date: "2026-06-16",
    type: "新機能",
    title: "ランキングページを追加しました",
    body: "読まれている本、読了者が多い本をトップ10形式で見られるようになりました。",
    href: "/rankings/reading",
  },
  {
    id: "account-deactivation-visibility",
    date: "2026-06-16",
    type: "改善",
    title: "退会後の表示と削除処理を見直しました",
    body: "退会済みユーザーがプロフィール、友だち、DM、読書会などに表示されにくくなるよう調整しました。",
    href: "/privacy",
  },
  {
    id: "public-user-profile-links",
    date: "2026-06-16",
    type: "改善",
    title: "友だちのプロフィールを見やすくしました",
    body: "友だちの読書中の本、読了した本、友だち一覧を見られるようにしました。",
  },
];
