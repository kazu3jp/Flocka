import { backupWithLiveReferences } from "./backup-references";
import { invalidPRSource } from "./pr-draft-references";

/** Audit rows outlive an erased administrator, without the name or free-text note. */
export const ERASED_ADMIN_ID = "erased-account";

/** All predicates use the same bound ID. The batch preserves FK ordering atomically. */
export async function eraseAccountRows(
  db: D1Database,
  accountId: string,
): Promise<void> {
  const pieces =
    "SELECT id FROM testimonies WHERE sender_id = ?1 OR recipient_id = ?1";
  const exchanges =
    "SELECT id FROM exchanges WHERE player_a = ?1 OR player_b = ?1";
  const requests = `SELECT id FROM moderation_requests WHERE account_id = ?1 OR testimony_id IN (${pieces})`;
  const outbox = `SELECT id FROM notification_outbox WHERE account_id = ?1 OR resource_id IN (${pieces}) OR resource_id IN (${exchanges})`;
  const statements = [
    // Remove mirrored copies in peers' private backups before deleting source rows.
    `UPDATE backups SET snapshot_json = ${backupWithLiveReferences("snapshot_json", "account_id", "?1")}, revision = revision + 1
      WHERE account_id != ?1 AND (snapshot_json LIKE '%' || ?1 || '%'
        OR EXISTS(SELECT 1 FROM json_each(snapshot_json, '$.reports') AS r WHERE json_extract(r.value, '$.pieceId') IN (${pieces}))
        OR EXISTS(SELECT 1 FROM json_each(snapshot_json, '$.deletions') AS r WHERE json_extract(r.value, '$.pieceId') IN (${pieces})))`,
    // Only drafts quoting the erased player's testimonies lose their text; other drafts stay.
    `UPDATE player_preferences SET data_json = json_remove(json_set(data_json, '$.prDraft', NULL), '$.prDraftSource', '$.prDraftOrigin'), revision = revision + 1
      WHERE account_id IN (SELECT recipient_id FROM testimonies WHERE sender_id = ?1)
        AND ${invalidPRSource("player_preferences.data_json", "player_preferences.account_id", "?1")}`,
    `DELETE FROM moderation_audit WHERE request_id IN (${requests})`,
    `UPDATE moderation_audit SET admin_id = '${ERASED_ADMIN_ID}', note = '' WHERE admin_id = ?1`,
    `DELETE FROM moderation_requests WHERE account_id = ?1 OR testimony_id IN (${pieces})`,
    // A deleted administrator's name/notes must not remain on unrelated reports.
    "UPDATE moderation_requests SET resolved_by = NULL, resolution = NULL WHERE resolved_by = ?1",
    `DELETE FROM push_receipts WHERE outbox_id IN (${outbox}) OR token IN (SELECT token FROM push_devices WHERE account_id = ?1)`,
    `DELETE FROM notification_outbox WHERE id IN (${outbox})`,
    "DELETE FROM testimonies WHERE sender_id = ?1 OR recipient_id = ?1",
    "DELETE FROM invites WHERE account_id = ?1 OR used_by = ?1",
    "DELETE FROM blocks WHERE account_id = ?1 OR blocked_id = ?1",
    "DELETE FROM exchanges WHERE player_a = ?1 OR player_b = ?1",
    // preferences/backups/devices/legacy sessions cascade from accounts.
    "DELETE FROM accounts WHERE id = ?1",
    "DELETE FROM auth_verifications WHERE value = ?1 OR identifier = (SELECT email FROM auth_users WHERE id = ?1) OR identifier IN (SELECT 'email-verification-otp-' || email FROM auth_users WHERE id = ?1)",
    "DELETE FROM api_request_limits WHERE key LIKE ?1 || ':%'",
    // Legal acceptance, sessions and provider accounts cascade from auth_users.
    "DELETE FROM auth_users WHERE id = ?1",
  ];
  await db.batch(statements.map((sql) => db.prepare(sql).bind(accountId)));
}
