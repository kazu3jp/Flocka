import { Resend } from "resend";
import { APIError } from "better-auth/api";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export async function sendAuthEmail(
  env: Env,
  input: { to: string; subject: string; text: string; html: string },
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM)
    throw new APIError("SERVICE_UNAVAILABLE", {
      code: "EMAIL_NOT_CONFIGURED",
      message: "メール配信の設定が必要です",
    });
  const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.RESEND_FROM,
    ...input,
  });
  if (error) {
    // Provider errors can contain email addresses. Never log the response body.
    throw new APIError("BAD_GATEWAY", {
      code: "EMAIL_DELIVERY_FAILED",
      message: "メールを送信できませんでした。時間をおいて再試行してください",
    });
  }
}
export function verificationEmail(email: string, otp: string) {
  return {
    to: email,
    subject: "Flocka：メールアドレスの確認",
    text: `確認コードは ${otp} です。10分以内に入力してください。心当たりがなければ、このメールを破棄してください。`,
    html: `<div style="background:#f8f5e3;padding:32px;font-family:sans-serif;color:#161b34"><h1>Flocka</h1><h2>メールアドレスの確認</h2><p>確認コードをアプリに入力してください。</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${escapeHtml(otp)}</p><p>有効期限は10分です。心当たりがなければ、このメールを破棄してください。</p></div>`,
  };
}
export function resetEmail(email: string, url: string) {
  return {
    to: email,
    subject: "Flocka：パスワードの再設定",
    text: `30分以内に次のリンクからパスワードを再設定してください。\n${url}\n心当たりがなければ、このメールを破棄してください。`,
    html: `<div style="background:#f8f5e3;padding:32px;font-family:sans-serif;color:#161b34"><h1>Flocka</h1><h2>パスワードの再設定</h2><p><a href="${escapeHtml(url)}">新しいパスワードを設定する</a></p><p>有効期限は30分です。心当たりがなければ、このメールを破棄してください。</p></div>`,
  };
}
