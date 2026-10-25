import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authErrorMessage,
  browserFlowErrorMessage,
  googleExchangeErrorMessage,
  googleSheetErrorMessage,
} from "../apps/mobile/src/features/auth/auth-error-message";
import { oauthErrorFromUrl } from "../apps/mobile/src/features/auth/oauth-error-url";
import { GOOGLE_MARK_PATHS } from "../apps/mobile/src/features/auth/google-mark-paths";

test("the Google mark keeps Google's four brand colours", () => {
  assert.deepEqual(GOOGLE_MARK_PATHS.map((part) => part.fill).sort(), [
    "#34A853",
    "#4285F4",
    "#EA4335",
    "#FBBC05",
  ]);
  for (const part of GOOGLE_MARK_PATHS) assert.match(part.d, /^M[\d.,]+ /);
});

test("auth errors never show the library's English text; the code names the cause", () => {
  assert.equal(
    authErrorMessage({
      status: 500,
      code: "FAILED_TO_CREATE_SESSION",
      message: "Failed to create session",
    }),
    "認証処理に失敗しました（FAILED_TO_CREATE_SESSION）",
  );
  assert.equal(
    authErrorMessage({ status: 502, message: "Bad gateway" }),
    "認証処理に失敗しました（HTTP 502）",
  );
  assert.equal(
    authErrorMessage({ message: "アカウントの削除を処理中です" }),
    "アカウントの削除を処理中です",
  );
});

test("Google exchange failures are worded for Google, not for email verification", () => {
  assert.match(
    googleExchangeErrorMessage({ status: 401, code: "INVALID_TOKEN" }),
    /Google/,
  );
  assert.match(
    googleExchangeErrorMessage({ status: 403, code: "EMAIL_NOT_VERIFIED" }),
    /Googleアカウント/,
  );
  assert.equal(
    googleExchangeErrorMessage({
      status: 401,
      code: "INVALID_EMAIL_OR_PASSWORD",
    }),
    "メールアドレスまたはパスワードを確認してください",
  );
});

test("browser flow errors keep the server's code so it can be reported", () => {
  assert.match(browserFlowErrorMessage("invalid_code"), /（invalid_code）$/);
  assert.match(
    browserFlowErrorMessage("brand_new_code"),
    /Googleログインに失敗しました（brand_new_code）/,
  );
  assert.equal(
    oauthErrorFromUrl("flocka://auth?error=access_denied"),
    "access_denied",
  );
  assert.equal(oauthErrorFromUrl("flocka://?cookie=secret"), null);
  assert.equal(oauthErrorFromUrl("flocka://auth?error=<script>"), null);
  assert.equal(oauthErrorFromUrl("not a url"), null);
});

test("Google sheet failures map to actionable Japanese copy", () => {
  for (const code of [
    "NO_ACCOUNT",
    "PROVIDER_UNAVAILABLE",
    "INTERRUPTED",
    "CONFIGURATION",
    "UNSUPPORTED",
  ])
    assert.doesNotMatch(googleSheetErrorMessage(code), /（[A-Z_]+）$/);
  assert.match(googleSheetErrorMessage("FAILED"), /（FAILED）/);
});
