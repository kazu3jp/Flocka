import type { Profile } from "@flocka/domain";

type ProfileEdit = { profile: Profile; self: string[] };

/**
 * Whether the edit screen holds the saved profile. Text is compared as it
 * would be saved (trimmed), so stray spaces alone do not count as a change.
 */
export function sameProfileEdit(saved: ProfileEdit, edited: ProfileEdit) {
  return JSON.stringify(normalize(saved)) === JSON.stringify(normalize(edited));
}

function normalize({ profile, self }: ProfileEdit) {
  return {
    ...profile,
    name: profile.name.trim(),
    role: profile.role.trim(),
    self,
  };
}
