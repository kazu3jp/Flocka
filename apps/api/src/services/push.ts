const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

type OutboxRow = {
  id: string;
  account_id: string;
  kind: "testimony" | "exchange" | "moderation";
  attempts: number;
};
type ExpoTicket = { status: "ok" | "error"; details?: { error?: string } };

const MESSAGES: Record<OutboxRow["kind"], { title: string; body: string }> = {
  testimony: { title: "封筒が届きました", body: "新しい印象が届いています" },
  exchange: { title: "交換が成立しました", body: "つながりが増えました" },
  moderation: { title: "ご依頼を確認しました", body: "対応結果を確認できます" },
};

function backoffMinutes(attempts: number): number {
  return Math.min(60, 2 ** attempts);
}

async function deviceTokens(db: D1Database, accountId: string) {
  const rows = await db
    .prepare("SELECT token FROM push_devices WHERE account_id = ?")
    .bind(accountId)
    .all<{ token: string }>();
  return rows.results.map((row) => row.token);
}

async function sendToExpo(
  tokens: string[],
  message: { title: string; body: string },
): Promise<ExpoTicket[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(
      tokens.map((to) => ({ to, sound: "default", ...message })),
    ),
  });
  if (!response.ok) throw new Error(`push gateway ${response.status}`);
  const body = (await response.json()) as { data?: ExpoTicket[] };
  return body.data ?? [];
}

async function deliverOne(db: D1Database, row: OutboxRow): Promise<void> {
  const tokens = await deviceTokens(db, row.account_id);
  const now = new Date().toISOString();
  if (tokens.length) {
    const tickets = await sendToExpo(tokens, MESSAGES[row.kind]);
    const dead = tokens.filter(
      (_, index) => tickets[index]?.details?.error === "DeviceNotRegistered",
    );
    for (const token of dead)
      await db
        .prepare("DELETE FROM push_devices WHERE token = ?")
        .bind(token)
        .run();
  }
  await db
    .prepare("UPDATE notification_outbox SET delivered_at = ? WHERE id = ?")
    .bind(now, row.id)
    .run();
}

/** Delivers due outbox rows; failures are retried with exponential backoff. */
export async function dispatchNotifications(db: D1Database): Promise<number> {
  const now = new Date().toISOString();
  const due = await db
    .prepare(
      "SELECT id, account_id, kind, attempts FROM notification_outbox WHERE delivered_at IS NULL AND attempts < ? AND next_attempt_at <= ? ORDER BY created_at LIMIT ?",
    )
    .bind(MAX_ATTEMPTS, now, BATCH_SIZE)
    .all<OutboxRow>();
  let delivered = 0;
  for (const row of due.results) {
    try {
      await deliverOne(db, row);
      delivered += 1;
    } catch {
      const next = new Date(
        Date.now() + backoffMinutes(row.attempts + 1) * 60_000,
      ).toISOString();
      await db
        .prepare(
          "UPDATE notification_outbox SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?",
        )
        .bind(next, row.id)
        .run();
      console.error(
        JSON.stringify({ event: "push.delivery_failed", kind: row.kind }),
      );
    }
  }
  return delivered;
}
