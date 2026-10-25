/**
 * The Google "Web application" OAuth client ID. It is public (it is sent to
 * Google and sits inside every ID token), so it ships in the app bundle.
 * Android shows the native Google sheet only when it was present at build time.
 * This is the one place that reads it.
 */
export const GOOGLE_WEB_CLIENT_ID: string | undefined =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined;
