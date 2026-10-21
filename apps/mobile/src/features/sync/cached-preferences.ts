import type { Preferences } from "@flocka/domain";
import { sameData } from "./same-data";

/** The last preferences this device knows the server accepted, and their revision. */
export type PreferenceSyncMark = { revision: number; saved: Preferences };

export function readPreferenceSyncMark(
  raw: string | null,
): PreferenceSyncMark | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      Number.isInteger((value as PreferenceSyncMark).revision) &&
      (value as PreferenceSyncMark).saved &&
      typeof (value as PreferenceSyncMark).saved === "object"
    )
      return value as PreferenceSyncMark;
  } catch {
    // An unreadable mark only loses the chance to resend; the server copy stays.
  }
  return null;
}

export type CachedPreferencePlan =
  | { kind: "none" }
  /** Unsaved edits based on the server's current revision: send them. */
  | { kind: "upload"; data: Preferences; revision: number; legacy: boolean }
  /** Unsaved edits, but the server changed since: let the user compare. */
  | { kind: "conflict"; local: Preferences };

/**
 * Decide what to do with preferences cached on this device after the server
 * snapshot loads. Unsaved edits survive a sign-out and are offered again to the
 * same account, without ever overwriting a newer server revision.
 */
export function planCachedPreferences({
  cached,
  onboarded,
  mark,
  server,
  defaults,
}: {
  cached: Preferences;
  onboarded: boolean;
  mark: PreferenceSyncMark | null;
  server: { data: Preferences; revision: number };
  defaults: Preferences;
}): CachedPreferencePlan {
  if (!onboarded || sameData(cached, server.data)) return { kind: "none" };
  if (mark) {
    if (sameData(cached, mark.saved)) return { kind: "none" };
    return mark.revision === server.revision
      ? {
          kind: "upload",
          data: cached,
          revision: server.revision,
          legacy: false,
        }
      : { kind: "conflict", local: cached };
  }
  // A cache from before revisions were recorded is only offered to an untouched record.
  return server.revision === 1 && sameData(server.data, defaults)
    ? { kind: "upload", data: cached, revision: 1, legacy: true }
    : { kind: "none" };
}
