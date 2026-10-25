import { Platform } from "react-native";
import { UserFacingError } from "../sync/user-facing-error";
import { assertAuthResult, getAuthClient } from "./client";
import { browserFlowErrorMessage } from "./auth-error-message";
import {
  nativeGoogleSignInAvailable,
  requestGoogleIdToken,
} from "./google-native-signin";
import { watchOAuthErrorRedirect } from "./oauth-error-redirect";

/** Where the browser flow returns on success and where it reports a failure. */
export function googleRedirectTargets(returnURL?: string) {
  if (Platform.OS === "web")
    return {
      callbackURL: returnURL ?? window.location.origin,
      errorCallbackURL: new URL("/auth", window.location.origin).href,
    };
  return {
    callbackURL: returnURL ?? "flocka://",
    errorCallbackURL: "flocka://auth",
  };
}

/**
 * Signs in with Google. Android with a configured client ID uses the native
 * account sheet and exchanges its ID token; everything else uses the browser
 * redirect. Resolves to "cancelled" when the person closed the sheet, and
 * throws a message written for the user for every real failure.
 */
export async function signInWithGoogle(
  returnURL?: string,
): Promise<"done" | "cancelled"> {
  if (nativeGoogleSignInAvailable()) {
    const credential = await requestGoogleIdToken();
    if (!credential) return "cancelled";
    assertAuthResult(
      await getAuthClient().signIn.social({
        provider: "google",
        idToken: { token: credential.token, nonce: credential.nonce },
      }),
      "google-exchange",
    );
    return "done";
  }
  const watcher = Platform.OS === "web" ? null : watchOAuthErrorRedirect();
  try {
    assertAuthResult(
      await getAuthClient().signIn.social({
        provider: "google",
        ...googleRedirectTargets(returnURL),
      }),
    );
    const failure = watcher?.error();
    if (failure) throw new UserFacingError(browserFlowErrorMessage(failure));
  } finally {
    watcher?.stop();
  }
  return "done";
}
