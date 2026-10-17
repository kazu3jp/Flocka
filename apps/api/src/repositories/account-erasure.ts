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
  const arrayWithout = (path: string, predicate: string) =>
    `COALESCE((SELECT json_group_array(json(value)) FROM json_each(snapshot_json, '$.${path}') WHERE ${predicate}), json('[]'))`;
  const statements = [
    // Remove mirrored copies in peers' private backups before deleting source rows.
    `UPDATE backups SET snapshot_json = json_set(snapshot_json,
      '$.connections', json(${arrayWithout("connections", "json_extract(value, '$.peerId') != ?1")}),
      '$.vibes', json(${arrayWithout("vibes", "json_extract(value, '$.fromId') != ?1")}),
      '$.proofs', json(${arrayWithout("proofs", "json_extract(value, '$.fromId') != ?1")}),
      '$.sentVibes', json(${arrayWithout("sentVibes", "json_extract(value, '$.toId') != ?1")}),
      '$.sentProofs', json(${arrayWithout("sentProofs", "json_extract(value, '$.toId') != ?1")}),
      '$.blocked', json(COALESCE((SELECT json_group_array(value) FROM json_each(snapshot_json, '$.blocked') WHERE value != ?1), json('[]'))),
      '$.reports', json(${arrayWithout("reports", `json_extract(value, '$.pieceId') NOT IN (${pieces})`)}),
      '$.deletions', json(${arrayWithout("deletions", `json_extract(value, '$.pieceId') NOT IN (${pieces})`)}),
      '$.prDraft', NULL), revision = revision + 1
      WHERE account_id != ?1 AND snapshot_json LIKE '%' || ?1 || '%'`,
    `UPDATE player_preferences SET data_json = json_set(data_json, '$.prDraft', NULL), revision = revision + 1
      WHERE account_id IN (SELECT player_a FROM exchanges WHERE player_b = ?1 UNION SELECT player_b FROM exchanges WHERE player_a = ?1)`,
    `DELETE FROM moderation_audit WHERE admin_id = ?1 OR request_id IN (${requests})`,
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
