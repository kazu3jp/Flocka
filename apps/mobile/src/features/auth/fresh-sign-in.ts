/**
 * Signing in starts on the home screen. The last screen is only restored when
 * the app is opened again with a session that is still valid.
 *
 * The sign-in screen marks that a sign-in is about to happen; the first load of
 * the next account's state takes the mark and ignores the saved position, which
 * is otherwise whatever screen the account was on when it signed out.
 */
export const FRESH_SIGN_IN_WINDOW_MS = 10 * 60_000;

let markedAt: number | null = null;

export function markFreshSignIn(now = Date.now()) {
  markedAt = now;
}

/** True once per mark, and only while the mark is recent. */
export function consumeFreshSignIn(now = Date.now()) {
  const fresh = markedAt !== null && now - markedAt < FRESH_SIGN_IN_WINDOW_MS;
  markedAt = null;
  return fresh;
}
