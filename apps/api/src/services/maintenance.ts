const OUTBOX_RETENTION_MS = 7 * 24 * 3600_000;
const ORPHAN_AVATAR_GRACE_MS = 24 * 3600_000;
const AVATAR_SCAN_LIMIT = 500;

async function deleteExpiredRows(db: D1Database, now: Date): Promise<void> {
  const iso = now.toISOString(),
    epoch = now.getTime(),
    window = Math.floor(epoch / 60_000);
  await db.batch([
    db.prepare("DELETE FROM invites WHERE expires_at < ?").bind(iso),
    db.prepare("DELETE FROM auth_sessions WHERE expires_at < ?").bind(epoch),
    db
      .prepare("DELETE FROM auth_verifications WHERE expires_at < ?")
      .bind(epoch),
    db
      .prepare("DELETE FROM api_request_limits WHERE window < ?")
      .bind(window - 5),
    db
      .prepare(
        "DELETE FROM notification_outbox WHERE created_at < ? AND (delivered_at IS NOT NULL OR attempts >= 5)",
      )
      .bind(new Date(epoch - OUTBOX_RETENTION_MS).toISOString()),
    db
      .prepare("DELETE FROM push_receipts WHERE created_at < ?")
      .bind(new Date(epoch - OUTBOX_RETENTION_MS).toISOString()),
  ]);
}

/** Removes avatar objects that no account or backup references any more. */
async function deleteOrphanAvatars(env: Env, now: Date): Promise<void> {
  const checkpoint = await env.DB.prepare(
    "SELECT cursor FROM maintenance_cursors WHERE name = 'avatars'",
  ).first<{ cursor: string }>();
  const listing = await env.AVATARS.list({
    ...(checkpoint ? { cursor: checkpoint.cursor } : {}),
    prefix: "avatars/",
    limit: AVATAR_SCAN_LIMIT,
  });
  for (const object of listing.objects) {
    if (now.getTime() - object.uploaded.getTime() < ORPHAN_AVATAR_GRACE_MS)
      continue;
    const used = await env.DB.prepare(
      "SELECT 1 FROM accounts WHERE avatar_key = ? UNION ALL SELECT 1 FROM backups WHERE avatar_key = ? LIMIT 1",
    )
      .bind(object.key, object.key)
      .first();
    if (!used) await env.AVATARS.delete(object.key);
  }
  if (listing.truncated) {
    await env.DB.prepare(
      "INSERT INTO maintenance_cursors(name, cursor) VALUES('avatars', ?) ON CONFLICT(name) DO UPDATE SET cursor = excluded.cursor",
    )
      .bind(listing.cursor)
      .run();
  } else {
    await env.DB.prepare(
      "DELETE FROM maintenance_cursors WHERE name = 'avatars'",
    ).run();
  }
}

export async function runMaintenance(
  env: Env,
  now = new Date(),
): Promise<void> {
  await deleteExpiredRows(env.DB, now);
  await deleteOrphanAvatars(env, now);
}
