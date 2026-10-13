import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { FlockaApiClient } from "@flocka/api-client";

export const API_URL = process.env.EXPO_PUBLIC_API_URL;
function makeAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      emailOTPClient(),
      inferAdditionalFields({
        user: { termsAccepted: { type: "boolean", required: false } },
      }),
      expoClient({
        scheme: "flocka",
        storagePrefix: "flocka-auth",
        storage: SecureStore,
        disableCache: true,
      }),
    ],
    fetchOptions: { timeout: 15_000 },
  });
}
let client: ReturnType<typeof makeAuthClient> | undefined;
export function getAuthClient() {
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URLを設定してください");
  const url = new URL(API_URL);
  if (url.protocol !== "https:" && !(__DEV__ && url.protocol === "http:"))
    throw new Error("認証APIにはHTTPSを指定してください");
  client ??= makeAuthClient(API_URL);
  return client;
}
export function getApiClient(accountId?: string) {
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URLを設定してください");
  return new FlockaApiClient(
    API_URL,
    Platform.OS === "web"
      ? { credentials: "include", accountId }
      : {
          accountId,
          cookie: () => getAuthClient().getCookie() ?? "",
          credentials: "omit",
        },
    __DEV__,
  );
}
export function assertAuthResult(result: {
  error: { message?: string; code?: string } | null;
}) {
  if (result.error) {
    const messages: Record<string, string> = {
      INVALID_EMAIL_OR_PASSWORD:
        "メールアドレスまたはパスワードを確認してください",
      EMAIL_NOT_VERIFIED:
        "メールアドレスの確認が必要です。確認コードを送信してください",
      INVALID_OTP: "確認コードを確認してください",
      OTP_EXPIRED: "確認コードの有効期限が切れています。再送してください",
      TOO_MANY_ATTEMPTS:
        "試行回数の上限に達しました。時間をおいて再試行してください",
      USER_ALREADY_EXISTS: "登録済みのメールアドレスです。ログインしてください",
    };
    throw new Error(
      messages[result.error.code ?? ""] ??
        result.error.message ??
        "認証処理に失敗しました",
    );
  }
}
