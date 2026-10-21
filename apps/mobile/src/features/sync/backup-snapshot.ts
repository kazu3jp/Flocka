import { preferencesOf, withPreferences, type State } from "@flocka/domain";

/**
 * The backup body is limited to 1 MiB and the photo is stored separately under
 * its avatar key, so the snapshot never carries the photo bytes.
 */
export function backupSnapshotOf(state: State): State {
  const { photo: _photo, ...avatar } = state.profile.avatar;
  return { ...state, profile: { ...state.profile, avatar } };
}

/** Restoring a backup replaces every saved preference, including the PR draft source. */
export function withRestoredPreferences(state: State, snapshot: State): State {
  return withPreferences(state, preferencesOf(snapshot));
}
