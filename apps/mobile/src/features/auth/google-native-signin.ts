import { Platform } from "react-native";
import { getRandomBytes } from "expo-crypto";
import NativeGoogleSignIn from "../../../modules/flocka-google-signin/src/FlockaGoogleSignInModule";
import { UserFacingError } from "../sync/user-facing-error";
import { googleSheetErrorMessage } from "./auth-error-message";
import { GOOGLE_WEB_CLIENT_ID } from "./google-config";

/**
 * Android signs in with the native Google sheet; iOS and the web keep the
 * browser redirect. An Android build without the module or the client ID is
 * misconfigured and reports it instead of switching to the browser.
 */
export function usesNativeGoogleSignIn() {
  return Platform.OS === "android";
}

const randomNonce = () =>
  Array.from(getRandomBytes(16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

/**
 * Opens the Google account sheet and returns the ID token with the nonce that
 * is inside it. Returns null when the person closed the sheet (not an error).
 */
export async function requestGoogleIdToken(): Promise<{
  token: string;
  nonce: string;
} | null> {
  if (!NativeGoogleSignIn || !GOOGLE_WEB_CLIENT_ID) {
    // Logcat line for the operator: the build lacks what the sheet needs.
    console.warn(
      `[auth] native Google sign-in is not configured: ${NativeGoogleSignIn ? "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID was not set at build time" : "the FlockaGoogleSignIn module is missing from this build"}`,
    );
    throw new UserFacingError(
      "このアプリのGoogleログインの設定が不足しています。運営にお問い合わせください",
    );
  }
  const nonce = randomNonce();
  try {
    const token = await NativeGoogleSignIn.signIn(GOOGLE_WEB_CLIENT_ID, nonce);
    return { token, nonce };
  } catch (error) {
    const { code = "FAILED", message = "" } = error as {
      code?: string;
      message?: string;
    };
    if (code === "CANCELLED") return null;
    // Logcat line for the operator; the message holds no token.
    console.warn(`[auth] native Google sign-in failed: ${code} ${message}`);
    throw new UserFacingError(googleSheetErrorMessage(code));
  }
}
