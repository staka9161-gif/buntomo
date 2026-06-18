export type UpdateEntry = {
  id: string;
  date: string;
  type: "新機能" | "改善" | "修正" | "お知らせ";
  title: string;
  body: string;
  href?: string;
  topicTags?: string[];
};

// ユーザーに知らせるべき新機能・改善・修正を行った場合は、
// 実装と同じタイミングで、利用者にとって何が変わったかを追加する。
export const updateTopicTags = [
  "読書会",
  "通報",
  "DM",
  "アカウント",
  "管理",
  "プライバシー",
  "お知らせ",
  "検索",
  "マイページ",
  "安全",
  "ランキング",
  "友だち",
  "分析",
] as const;

export const updateFrequentWords = [
  "気になる",
  "通報",
  "DM",
  "読書会",
  "アカウント停止",
  "異議申し立て",
  "重要なお知らせ",
  "ランキング",
  "読了日",
  "Google Analytics",
] as const;

export const updates: UpdateEntry[] = [
  {
    id: "updates-search-tags-2026-06-17",
    date: "2026-06-17",
    type: "改善",
    title: "お知らせを探しやすくしました",
    body: "お知らせページでキーワード検索、内容タグ、よく使われる言葉から更新内容を探せるようになりました。",
    topicTags: ["お知らせ", "検索"],
  },
  {
    id: "reading-event-interest-2026-06-17",
    date: "2026-06-17",
    type: "改善",
    title: "読書会に「気になる」ができるようになりました",
    body: "参加を迷っている読書会を気になるリストに保存し、あとからマイページで確認できるようになりました。詳しい表示範囲も確認できます。",
    href: "/updates/reading-event-interest",
    topicTags: ["読書会", "マイページ"],
  },
  {
    id: "important-announcements-2026-06-17",
    date: "2026-06-17",
    type: "改善",
    title: "運営からの重要なお知らせ表示に対応しました",
    body: "サービスに関する重要なお知らせがある場合に、画面上で確認できるようになりました。",
    href: "/updates",
    topicTags: ["お知らせ", "安全"],
  },
  {
    id: "analytics-policy-2026-06-17",
    date: "2026-06-17",
    type: "お知らせ",
    title: "アクセス解析に関する説明を追記しました",
    body: "サービス改善のためのアクセス解析について、プライバシーポリシーに説明を追記しました。",
    href: "/privacy",
    topicTags: ["プライバシー", "分析"],
  },
  {
    id: "suspension-appeal-2026-06-17",
    date: "2026-06-17",
    type: "改善",
    title: "利用停止中の異議申し立てに対応しました",
    body: "アカウントが利用停止中の場合でもログイン後に状態を確認し、運営へ異議申し立てを送れるようになりました。",
    href: "/updates",
    topicTags: ["アカウント", "安全"],
  },
  {
    id: "report-direct-messages-2026-06-16",
    date: "2026-06-16",
    type: "改善",
    title: "DMの通報に対応しました",
    body: "ダイレクトメッセージで不適切な内容を受け取った場合に、運営へ知らせられるようになりました。",
    href: "/updates",
    topicTags: ["通報", "DM", "安全"],
  },
  {
    id: "clarify-report-handling-policy-2026-06-16",
    date: "2026-06-16",
    type: "お知らせ",
    title: "通報対応に関する説明を追記しました",
    body: "通報があった場合に、運営が安全確保のため必要な範囲で内容を確認することがある旨を、利用規約とプライバシーポリシーに追記しました。",
    href: "/updates",
    topicTags: ["通報", "プライバシー", "安全"],
  },
  {
    id: "report-reviews-events-2026-06-16",
    date: "2026-06-16",
    type: "改善",
    title: "レビューと読書会の通報に対応しました",
    body: "公共の目に触れるレビューや読書会について、不適切な内容が気になる場合に運営へ知らせられるようになりました。",
    href: "/updates",
    topicTags: ["通報", "読書会", "安全"],
  },
  {
    id: "report-chat-messages-2026-06-16",
    date: "2026-06-16",
    type: "改善",
    title: "チャットの通報に対応しました",
    body: "公共の目に触れるチャット投稿について、不適切な内容が気になる場合に運営へ知らせられるようになりました。",
    href: "/updates",
    topicTags: ["通報", "安全"],
  },
  {
    id: "report-user-profiles-2026-06-16",
    date: "2026-06-16",
    type: "新機能",
    title: "プロフィールを通報できるようにしました",
    body: "不適切なプロフィールや迷惑行為が気になる場合に、運営へ知らせられるようになりました。安心して使える環境づくりに役立てていきます。",
    href: "/updates",
    topicTags: ["通報", "安全"],
  },
  {
    id: "completed-page-improvements",
    date: "2026-06-16",
    type: "改善",
    title: "読了ページを見やすくしました",
    body: "読了日順の並び替え、年ごとの冊数表示、読了日の変更に対応しました。読書の記録をふりかえりやすくなりました。",
    href: "/mypage/completed",
    topicTags: ["マイページ"],
  },
  {
    id: "book-rankings",
    date: "2026-06-16",
    type: "新機能",
    title: "ランキングページを追加しました",
    body: "読まれている本、読了者が多い本をトップ10形式で見られるようになりました。",
    href: "/rankings/reading",
    topicTags: ["ランキング"],
  },
  {
    id: "account-deactivation-visibility",
    date: "2026-06-16",
    type: "改善",
    title: "退会後の表示と削除処理を見直しました",
    body: "退会済みユーザーがプロフィール、友だち、DM、読書会などに表示されにくくなるよう調整しました。",
    href: "/privacy",
    topicTags: ["アカウント", "プライバシー", "安全"],
  },
  {
    id: "public-user-profile-links",
    date: "2026-06-16",
    type: "改善",
    title: "友だちのプロフィールを見やすくしました",
    body: "友だちの読書中の本、読了した本、友だち一覧を見られるようにしました。",
    topicTags: ["友だち"],
  },
];
