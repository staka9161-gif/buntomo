import { prisma } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/mail";

const BASE_URL = () =>
  process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://buntomo.bunkare.jp";

/**
 * DM を受信したとき、相手にメール通知を送る。
 * 「同じ送信者からの未読 DM が既にある」場合はスキップ（対話中の連打防止）。
 */
export async function notifyDMReceived(
  senderId: string,
  recipientId: string,
  contentPreview: string
) {
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true, emailNotifDM: true, deactivatedAt: true },
    });
    if (!recipient?.emailNotifDM || recipient.deactivatedAt) return;

    // 同じ送信者からの未読 DM が既にあればスキップ
    const existingUnread = await prisma.directMessage.count({
      where: { senderId, recipientId, read: false },
    });
    if (existingUnread > 0) return;

    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true, deactivatedAt: true },
    });
    if (!sender || sender.deactivatedAt) return;

    const senderName = sender?.name ?? "誰か";
    const preview = contentPreview.length > 60 ? contentPreview.slice(0, 60) + "..." : contentPreview;

    await sendNotificationEmail(recipient.email, {
      subject: `【ブントモ】${senderName}さんから新しいメッセージが届きました`,
      heading: "新しいメッセージ",
      body: `${senderName}さんからメッセージが届きました。`,
      detail: preview,
      actionUrl: `${BASE_URL()}/mypage/messages/${senderId}`,
      actionLabel: "メッセージを読む",
      settingsUrl: `${BASE_URL()}/mypage/profile#notifications`,
    });
  } catch (e) {
    console.error("notifyDMReceived error:", e);
  }
}

/**
 * 友だち申請を受信したとき、相手にメール通知を送る。
 */
export async function notifyFriendRequest(requesterId: string, addresseeId: string) {
  try {
    const addressee = await prisma.user.findUnique({
      where: { id: addresseeId },
      select: { email: true, emailNotifFriendRequest: true, deactivatedAt: true },
    });
    if (!addressee?.emailNotifFriendRequest || addressee.deactivatedAt) return;

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { name: true, deactivatedAt: true },
    });
    if (!requester || requester.deactivatedAt) return;

    const requesterName = requester?.name ?? "誰か";

    await sendNotificationEmail(addressee.email, {
      subject: `【ブントモ】${requesterName}さんから友だち申請が届きました`,
      heading: "友だち申請",
      body: `${requesterName}さんから友だち申請が届きました。`,
      actionUrl: `${BASE_URL()}/mypage/friends`,
      actionLabel: "申請を確認する",
      settingsUrl: `${BASE_URL()}/mypage/profile#notifications`,
    });
  } catch (e) {
    console.error("notifyFriendRequest error:", e);
  }
}

/**
 * 友だち申請が承認されたとき、申請者にメール通知を送る。
 */
export async function notifyFriendAccepted(accepterId: string, requesterId: string) {
  try {
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { email: true, emailNotifFriendAccepted: true, deactivatedAt: true },
    });
    if (!requester?.emailNotifFriendAccepted || requester.deactivatedAt) return;

    const accepter = await prisma.user.findUnique({
      where: { id: accepterId },
      select: { name: true, deactivatedAt: true },
    });
    if (!accepter || accepter.deactivatedAt) return;

    const accepterName = accepter?.name ?? "誰か";

    await sendNotificationEmail(requester.email, {
      subject: `【ブントモ】${accepterName}さんが友だち申請を承認しました`,
      heading: "友だち申請が承認されました",
      body: `${accepterName}さんがあなたの友だち申請を承認しました。`,
      actionUrl: `${BASE_URL()}/users/${accepterId}`,
      actionLabel: "プロフィールを見る",
      settingsUrl: `${BASE_URL()}/mypage/profile#notifications`,
    });
  } catch (e) {
    console.error("notifyFriendAccepted error:", e);
  }
}
