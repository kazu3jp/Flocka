import { Platform } from "react-native";
import { getRandomBytes } from "expo-crypto";
import NativeGoogleSignIn from "../../../modules/flocka-google-signin/src/FlockaGoogleSignInModule";
import { UserFacingError } from "../sync/user-facing-error";
import { googleSheetErrorMessage } from "./auth-error-message";
import { GOOGLE_WEB_CLIENT_ID } from "./google-config";

let warned = false;
/** True when this build can show the native Google sheet (Android + client ID). */
export function nativeGoogleSignInAvailable() {
  if (Platform.OS !== "android" || !NativeGoogleSignIn) return false;
  if (!GOOGLE_WEB_CLIENT_ID) {
    if (!warned) {
      warned = true;
      console.warn(
        "[auth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID was not set at build time: Android falls back to the browser Google sign-in.",
      );
    }
    return false;
  }
  return true;
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
  if (!NativeGoogleSignIn || !GOOGLE_WEB_CLIENT_ID)
    throw new UserFacingError(
      "この端末ではアプリ内のGoogleログインを使えません",
    );
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
