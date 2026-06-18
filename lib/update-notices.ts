import { updateTopicTags, updateTypes, type UpdateEntry } from "./updates";

export const updateNoticeStatuses = ["draft", "published", "archived"] as const;

export type UpdateNoticeStatus = (typeof updateNoticeStatuses)[number];

export const updateNoticeStatusLabels: Record<UpdateNoticeStatus, string> = {
  draft: "下書き",
  published: "公開中",
  archived: "アーカイブ",
};

export const MAX_UPDATE_NOTICE_TITLE_LENGTH = 100;
export const MAX_UPDATE_NOTICE_BODY_LENGTH = 2000;

type UpdateNoticeInput = {
  title?: unknown;
  body?: unknown;
  type?: unknown;
  topicTag?: unknown;
  href?: unknown;
  status?: unknown;
  displayDate?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

export function validateUpdateNoticeInput(body: unknown, options: { allowStatus: boolean }) {
  const input = (body ?? {}) as UpdateNoticeInput;
  const title = normalizeText(input.title);
  const noticeBody = normalizeText(input.body);
  const type = normalizeText(input.type) || "お知らせ";
  const topicTag = normalizeText(input.topicTag);
  const href = normalizeText(input.href);
  const status = normalizeText(input.status) || "draft";
  const displayDate = parseDate(input.displayDate);

  if (!title) return { error: "タイトルを入力してください" };
  if (title.length > MAX_UPDATE_NOTICE_TITLE_LENGTH) {
    return { error: `タイトルは${MAX_UPDATE_NOTICE_TITLE_LENGTH}文字以内で入力してください` };
  }
  if (!noticeBody) return { error: "本文を入力してください" };
  if (noticeBody.length > MAX_UPDATE_NOTICE_BODY_LENGTH) {
    return { error: `本文は${MAX_UPDATE_NOTICE_BODY_LENGTH}文字以内で入力してください` };
  }
  if (!updateTypes.includes(type as UpdateEntry["type"])) {
    return { error: "種別が不正です" };
  }
  if (topicTag && !updateTopicTags.includes(topicTag as (typeof updateTopicTags)[number])) {
    return { error: "内容タグが不正です" };
  }
  if (options.allowStatus && !updateNoticeStatuses.includes(status as UpdateNoticeStatus)) {
    return { error: "status が不正です" };
  }
  if (displayDate === "invalid") return { error: "表示日が不正です" };

  return {
    data: {
      title,
      body: noticeBody,
      type,
      topicTag: topicTag || null,
      href: href || null,
      status: options.allowStatus ? (status as UpdateNoticeStatus) : "draft",
      displayDate,
    },
  };
}

export function actionForUpdateNoticeStatusChange(previousStatus: string, newStatus: string) {
  if (previousStatus !== "published" && newStatus === "published") {
    return "updateNotice.publish";
  }
  if (previousStatus !== "archived" && newStatus === "archived") {
    return "updateNotice.archive";
  }
  return "updateNotice.update";
}

export function truncateAuditTitle(title: string) {
  return title.length > 120 ? `${title.slice(0, 120)}...` : title;
}
