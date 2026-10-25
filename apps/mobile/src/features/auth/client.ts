import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { FlockaApiClient, type ApiClientError } from "@flocka/api-client";
import { authErrorMessage, parseRetryAfter } from "./auth-error-message";
import { infrastructureClientPlugins } from "./infrastructure-client";

export const API_URL = process.env.EXPO_PUBLIC_API_URL;
function makeAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      ...infrastructureClientPlugins(),
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
    fetchOptions: {
      timeout: 15_000,
      // The rate limiter names its wait only in a header, which the result object drops.
      onError: ({ response }) => {
        lastRetryAfter =
          response.status === 429
            ? parseRetryAfter(response.headers.get("X-Retry-After"))
            : null;
      },
    },
  });
}
let lastRetryAfter: number | null = null;
let client: ReturnType<typeof makeAuthClient> | undefined;
export function getAuthClient() {
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URLを設定してください");
  const url = new URL(API_URL);
  if (url.protocol !== "https:" && !(__DEV__ && url.protocol === "http:"))
    throw new Error("認証APIにはHTTPSを指定してください");
  client ??= makeAuthClient(API_URL);
  return client;
}
export function getApiClient(
  accountId?: string,
  onSessionFailure?: (error: ApiClientError) => void,
) {
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URLを設定してください");
  return new FlockaApiClient(
    API_URL,
    Platform.OS === "web"
      ? { credentials: "include", accountId, onSessionFailure }
      : {
          accountId,
          onSessionFailure,
          cookie: () => getAuthClient().getCookie() ?? "",
          credentials: "omit",
        },
    __DEV__,
  );
}
export function assertAuthResult(result: {
  error: { message?: string; code?: string; status?: number } | null;
}) {
  if (result.error)
    throw new Error(
      authErrorMessage(
        result.error,
        result.error.status === 429 ? lastRetryAfter : null,
      ),
    );
}
