export type AuthResultError = {
  message?: string;
  code?: string;
  status?: number;
};

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "メールアドレスまたはパスワードを確認してください",
  EMAIL_NOT_VERIFIED:
    "メールアドレスの確認が必要です。確認コードを送信してください",
  INVALID_TOKEN:
    "確認リンクが無効か期限切れです。確認メールをもう一度送信してください",
  ACCOUNT_DELETION_PENDING:
    "アカウントの削除を処理中です。完了までサーバーで再試行します",
  INVALID_OTP: "確認コードを確認してください",
  OTP_EXPIRED: "確認コードの有効期限が切れています。再送してください",
  TOO_MANY_ATTEMPTS:
    "試行回数の上限に達しました。時間をおいて再試行してください",
  USER_ALREADY_EXISTS: "登録済みのメールアドレスです。ログインしてください",
};

/** Seconds from a Retry-After style header; anything unreadable is unknown. */
export function parseRetryAfter(value: string | null | undefined) {
  if (!value) return null;
  const seconds = Number(value.trim());
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/**
 * Auth server errors arrive with English text from the library; the user only
 * sees fixed Japanese copy. A rate limit names the wait when the server sent one.
 */
export function authErrorMessage(
  error: AuthResultError,
  retryAfterSeconds: number | null = null,
) {
  const known = MESSAGES[error.code ?? ""];
  if (known) return known;
  if (error.status === 429)
    return retryAfterSeconds
      ? `操作が続いたため一時的に制限しています。${retryAfterSeconds}秒ほど待ってから再試行してください`
      : "操作が続いたため一時的に制限しています。時間をおいて再試行してください";
  return error.message ?? "認証処理に失敗しました";
}
