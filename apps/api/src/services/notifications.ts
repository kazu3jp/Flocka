export async function enqueueNotification(
  db: D1Database,
  accountId: string,
  kind: "testimony" | "exchange" | "moderation",
  resourceId: string,
): Promise<void> {
  const at = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO notification_outbox(id, account_id, kind, resource_id, created_at, next_attempt_at) VALUES(?, ?, ?, ?, ?, ?)",
    )
    .bind(crypto.randomUUID(), accountId, kind, resourceId, at, at)
    .run();
}
