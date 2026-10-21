/** The orphan sweep deletes unreferenced avatar objects older than this. */
export const ORPHAN_AVATAR_GRACE_MS = 24 * 3600_000;
/**
 * A backup may reference an unreferenced object only while it is clearly
 * younger than the grace period. Older objects must already be referenced in
 * D1, which the backup write checks in the same statement; once an object is
 * unreferenced and past this age nothing can reference it again, so the sweep
 * cannot delete a photo that a concurrent backup is about to keep.
 */
export const NEW_AVATAR_REFERENCE_MS = ORPHAN_AVATAR_GRACE_MS / 2;
