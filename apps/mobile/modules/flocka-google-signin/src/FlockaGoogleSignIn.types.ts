/**
 * Codes the native `signIn()` rejects with.
 * - `CANCELLED`: the person closed the sheet; not an error.
 * - `NO_ACCOUNT`: no Google account is signed in on the device.
 * - `PROVIDER_UNAVAILABLE`: Google Play services / credential provider missing or disabled.
 * - `INTERRUPTED`: the request was interrupted (usually the network); retry.
 * - `CONFIGURATION`: package name / SHA-1 / client ID do not match the Google Cloud setup.
 * - `UNSUPPORTED`, `NO_ACTIVITY`, `INVALID_CREDENTIAL`, `FAILED`: anything else.
 */
export type GoogleSignInErrorCode =
  | "CANCELLED"
  | "NO_ACCOUNT"
  | "PROVIDER_UNAVAILABLE"
  | "INTERRUPTED"
  | "CONFIGURATION"
  | "UNSUPPORTED"
  | "NO_ACTIVITY"
  | "INVALID_CREDENTIAL"
  | "FAILED";
