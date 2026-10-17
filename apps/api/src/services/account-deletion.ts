import { eraseAccountRows } from "../repositories/account-erasure";
import { revokeProviderTokens } from "./revoke-provider-tokens";

const LEASE_MS = 5 * 60_000;
const RETRY_MS = 5 * 60_000;

export async function accountDeletionPending(
  db: D1Database,
  id: string,
): Promise<boolean> {
  return Boolean(
    await db
      .prepare("SELECT 1 FROM account_deletions WHERE account_id = ?")
      .bind(id)
      .first(),
  );
}

/** Persist the intent before any external I/O. Revoke all existing sessions immediately. */
export async function beginAccountDeletion(
  env: Env,
  id: string,
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO account_deletions(account_id, requested_at, retry_after) VALUES(?, ?, ?)",
    ).bind(id, now, now),
    env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(id),
    env.DB.prepare(
      "DELETE FROM push_receipts WHERE token IN (SELECT token FROM push_devices WHERE account_id = ?)",
    ).bind(id),
    env.DB.prepare("DELETE FROM notification_outbox WHERE account_id = ?").bind(
      id,
    ),
    env.DB.prepare("DELETE FROM push_devices WHERE account_id = ?").bind(id),
  ]);
}

/** A bounded page per attempt avoids Worker time limits; the cron drains remaining pages. */
async function eraseAvatarPage(env: Env, id: string): Promise<boolean> {
  const listing = await env.AVATARS.list({
    prefix: `avatars/${id}/`,
    limit: 500,
  });
  if (listing.objects.length)
    await env.AVATARS.delete(listing.objects.map((object) => object.key));
  // Start at the beginning again after deletion; no cursor can skip objects.
  return !listing.truncated;
}

/** Returns false for pending work. Never reports completed deletion after partial failure. */
export async function processAccountDeletion(
  env: Env,
  id: string,
  now = new Date(),
): Promise<boolean> {
  const lease = await env.DB.prepare(
    "UPDATE account_deletions SET lease_until = ?, attempts = attempts + 1 WHERE account_id = ? AND (lease_until IS NULL OR lease_until < ?) RETURNING account_id",
  )
    .bind(
      new Date(now.getTime() + LEASE_MS).toISOString(),
      id,
      now.toISOString(),
    )
    .first();
  if (!lease) return false;
  try {
    await revokeProviderTokens(env, id);
    if (!(await eraseAvatarPage(env, id))) return false;
    await eraseAccountRows(env.DB, id);
    await env.DB.prepare("DELETE FROM account_deletions WHERE account_id = ?")
      .bind(id)
      .run();
    return true;
  } catch {
    // Deliberately omit IDs, addresses, provider bodies and tokens from logs.
    console.error(JSON.stringify({ event: "account.deletion_retry_required" }));
    return false;
  } finally {
    await env.DB.prepare(
      "UPDATE account_deletions SET lease_until = NULL, retry_after = ? WHERE account_id = ?",
    )
      .bind(new Date(now.getTime() + RETRY_MS).toISOString(), id)
      .run();
  }
}

export async function retryAccountDeletions(
  env: Env,
  now = new Date(),
): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT account_id FROM account_deletions WHERE retry_after <= ? ORDER BY requested_at LIMIT 10",
  )
    .bind(now.toISOString())
    .all<{ account_id: string }>();
  for (const row of results)
    await processAccountDeletion(env, row.account_id, now);
}
