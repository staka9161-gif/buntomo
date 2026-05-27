import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@booktogether.local";

export async function sendPasswordResetEmail(to: string, token: string) {
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `文とも <${FROM}>`,
    to,
    subject: "【文とも】パスワード再設定",
    text: [
      "文とも パスワード再設定のご案内",
      "",
      "以下のリンクをクリックして、新しいパスワードを設定してください。",
      "",
      resetUrl,
      "",
      "このリンクは1時間で有効期限が切れます。",
      "心当たりがない場合は、このメールを無視してください。",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #d97706;">文とも</h2>
        <p>パスワード再設定のリクエストを受け付けました。</p>
        <p>以下のボタンをクリックして、新しいパスワードを設定してください。</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}"
             style="background: #d97706; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            パスワードを再設定する
          </a>
        </p>
        <p style="color: #888; font-size: 13px;">このリンクは1時間で有効期限が切れます。</p>
        <p style="color: #888; font-size: 13px;">心当たりがない場合は、このメールを無視してください。</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, token: string) {
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `文とも <${FROM}>`,
    to,
    subject: "【文とも】メールアドレスの確認",
    text: [
      "文とも メールアドレス確認のご案内",
      "",
      "以下のリンクをクリックして、メールアドレスの確認を完了してください。",
      "",
      verifyUrl,
      "",
      "このリンクは24時間で有効期限が切れます。",
      "心当たりがない場合は、このメールを無視してください。",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #d97706;">文とも</h2>
        <p>メールアドレスの確認をお願いします。</p>
        <p>以下のボタンをクリックして、登録を完了してください。</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}"
             style="background: #d97706; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            メールアドレスを確認する
          </a>
        </p>
        <p style="color: #888; font-size: 13px;">このリンクは24時間で有効期限が切れます。</p>
        <p style="color: #888; font-size: 13px;">心当たりがない場合は、このメールを無視してください。</p>
      </div>
    `,
  });
}
