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
  // The library's English text is never shown; the code or status names the cause.
  const text = error.message;
  if (text && JAPANESE.test(text)) return text;
  const reason = error.code ?? (error.status ? `HTTP ${error.status}` : null);
  return reason
    ? `認証処理に失敗しました（${reason}）`
    : "認証処理に失敗しました";
}
const JAPANESE = /[぀-ヿ一-鿿]/;

/** Server answers to the Google ID-token exchange (`POST /sign-in/social`). */
const GOOGLE_EXCHANGE_MESSAGES: Record<string, string> = {
  INVALID_TOKEN:
    "Googleの認証情報をサーバーが確認できませんでした。もう一度お試しください",
  FAILED_TO_GET_USER_INFO: "Googleアカウントの情報を取得できませんでした",
  USER_EMAIL_NOT_FOUND:
    "Googleアカウントからメールアドレスを取得できませんでした",
  EMAIL_NOT_VERIFIED: "Googleアカウントのメールアドレスが未確認です",
  ID_TOKEN_NOT_SUPPORTED: "このサーバーはアプリ内のGoogleログインに未対応です",
  PROVIDER_NOT_FOUND: "このサーバーではGoogleログインを利用できません",
  OAUTH_LINK_ERROR:
    "同じメールアドレスのアカウントと連携できませんでした。メールとパスワードでログインしてください",
};
export function googleExchangeErrorMessage(
  error: AuthResultError,
  retryAfterSeconds: number | null = null,
) {
  return (
    GOOGLE_EXCHANGE_MESSAGES[error.code ?? ""] ??
    authErrorMessage(error, retryAfterSeconds)
  );
}

/**
 * `error` values Better Auth appends to the app's error callback URL when the
 * browser Google flow fails after leaving the app (the callback never reaches
 * a screen of the server). The code stays in the text so it can be reported.
 */
const BROWSER_FLOW_MESSAGES: Record<string, string> = {
  access_denied: "Googleでログインが許可されませんでした",
  invalid_code:
    "Googleとの認証コードの交換に失敗しました。サーバーのGoogle設定（クライアントIDとシークレット、リダイレクトURI）を確認してください",
  state_mismatch:
    "ログインの途中状態が見つかりませんでした。もう一度お試しください",
  state_not_found:
    "ログインの途中状態が見つかりませんでした。もう一度お試しください",
  state_invalid:
    "ログインの途中状態を確認できませんでした。もう一度お試しください",
  no_code: "Googleから認証コードが届きませんでした",
  unable_to_get_user_info: "Googleアカウントの情報を取得できませんでした",
  email_not_found: "Googleアカウントからメールアドレスを取得できませんでした",
  email_not_verified: "Googleアカウントのメールアドレスが未確認です",
  oauth_provider_not_found: "このサーバーではGoogleログインを利用できません",
  account_not_linked:
    "同じメールアドレスのアカウントと連携できませんでした。メールとパスワードでログインしてください",
  unable_to_link_account:
    "同じメールアドレスのアカウントと連携できませんでした。メールとパスワードでログインしてください",
  signup_disabled: "このサーバーでは新規登録ができません",
  unable_to_create_user: "アカウントを作成できませんでした",
  unable_to_create_session: "ログイン状態を作成できませんでした",
};
export function browserFlowErrorMessage(code: string) {
  const known = BROWSER_FLOW_MESSAGES[code];
  return `${known ?? "Googleログインに失敗しました"}（${code}）`;
}

/** Why the Android Google sheet ended without a token (see FlockaGoogleSignIn.types.ts). */
const GOOGLE_SHEET_MESSAGES: Record<string, string> = {
  NO_ACCOUNT:
    "この端末にGoogleアカウントがありません。端末の設定でアカウントを追加してください",
  PROVIDER_UNAVAILABLE:
    "Google Play開発者サービスを利用できません。更新または有効化してから再試行してください",
  INTERRUPTED: "通信が中断されました。接続を確認して、もう一度お試しください",
  CONFIGURATION:
    "このアプリのGoogleログイン設定（パッケージ名・署名・クライアントID）が一致していません",
  UNSUPPORTED: "この端末はGoogleログインに対応していません",
};
export function googleSheetErrorMessage(code: string) {
  const known = GOOGLE_SHEET_MESSAGES[code];
  return known ?? `Googleログインを開始できませんでした（${code}）`;
}
