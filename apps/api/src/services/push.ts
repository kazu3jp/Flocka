import { z } from "zod";

const PUSH_URL = "https://exp.host/--/api/v2/push/";
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;
const RECEIPT_DELAY_MS = 15 * 60_000;
const ticketSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), id: z.string().min(1) }),
  z.object({
    status: z.literal("error"),
    details: z.object({ error: z.string() }).optional(),
  }),
]);
const receiptSchema = z.object({
  status: z.enum(["ok", "error"]),
  details: z.object({ error: z.string() }).optional(),
});

type OutboxRow = {
  id: string;
  account_id: string;
  kind: "testimony" | "exchange" | "moderation";
  attempts: number;
};
const MESSAGES: Record<OutboxRow["kind"], { title: string; body: string }> = {
  testimony: { title: "封筒が届きました", body: "新しい印象が届いています" },
  exchange: { title: "交換が成立しました", body: "つながりが増えました" },
  moderation: { title: "ご依頼を確認しました", body: "対応結果を確認できます" },
};

async function expoRequest(path: string, body: unknown, accessToken?: string) {
  const response = await fetch(PUSH_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`push gateway ${response.status}`);
  return response.json();
}

async function removeDeadDevice(db: D1Database, token: string) {
  await db
    .prepare("DELETE FROM push_devices WHERE token = ?")
    .bind(token)
    .run();
}

async function deliverOne(
  db: D1Database,
  row: OutboxRow,
  accessToken?: string,
) {
  const at = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO push_deliveries(outbox_id, token)
      SELECT ?, token FROM push_devices WHERE account_id = ?
      AND EXISTS(SELECT 1 FROM notification_outbox WHERE id = ? AND initialized_at IS NULL)`,
      )
      .bind(row.id, row.account_id, row.id),
    db
      .prepare(
        "UPDATE notification_outbox SET initialized_at = COALESCE(initialized_at, ?) WHERE id = ?",
      )
      .bind(at, row.id),
  ]);
  const destinations = await db
    .prepare(
      "SELECT token FROM push_deliveries WHERE outbox_id = ? AND state = 'pending' ORDER BY token LIMIT 100",
    )
    .bind(row.id)
    .all<{ token: string }>();
  if (destinations.results.length) {
    const tokens = destinations.results.map(({ token }) => token);
    const result = z.object({ data: z.array(ticketSchema) }).parse(
      await expoRequest(
        "send",
        tokens.map((to) => ({
          to,
          sound: "default",
          ...MESSAGES[row.kind],
          data: { accountId: row.account_id, kind: row.kind },
        })),
        accessToken,
      ),
    );
    if (result.data.length !== tokens.length)
      throw new Error("Incomplete push tickets");
    for (const [index, ticket] of result.data.entries()) {
      const token = tokens[index];
      if (ticket.status === "ok") {
        await db.batch([
          db
            .prepare(
              "UPDATE push_deliveries SET state = 'accepted', ticket_id = ?, error_code = NULL WHERE outbox_id = ? AND token = ?",
            )
            .bind(ticket.id, row.id, token),
          db
            .prepare(
              "INSERT OR IGNORE INTO push_receipts(ticket_id, token, created_at, outbox_id) VALUES(?, ?, ?, ?)",
            )
            .bind(ticket.id, token, at, row.id),
        ]);
      } else {
        const code = ticket.details?.error ?? "UnknownError";
        if (code === "DeviceNotRegistered") {
          await removeDeadDevice(db, token);
          await db
            .prepare(
              "UPDATE push_deliveries SET state = 'failed', error_code = ? WHERE outbox_id = ? AND token = ?",
            )
            .bind(code, row.id, token)
            .run();
        } else {
          await db
            .prepare(
              "UPDATE push_deliveries SET error_code = ? WHERE outbox_id = ? AND token = ?",
            )
            .bind(code, row.id, token)
            .run();
        }
      }
    }
  }
  const pending = await db
    .prepare(
      "SELECT 1 FROM push_deliveries WHERE outbox_id = ? AND state = 'pending' LIMIT 1",
    )
    .bind(row.id)
    .first();
  if (pending) throw new Error("Push destinations still pending");
  await db
    .prepare(
      "UPDATE notification_outbox SET delivered_at = ?, lease_until = NULL WHERE id = ?",
    )
    .bind(at, row.id)
    .run();
}

/** Accepted tickets are stored separately from provider delivery receipts. */
export async function checkPushReceipts(
  db: D1Database,
  accessToken?: string,
): Promise<void> {
  const now = Date.now();
  const rows = await db
    .prepare(
      "SELECT ticket_id, token, created_at, outbox_id FROM push_receipts WHERE created_at <= ? ORDER BY created_at LIMIT 100",
    )
    .bind(new Date(now - RECEIPT_DELAY_MS).toISOString())
    .all<{
      ticket_id: string;
      token: string;
      created_at: string;
      outbox_id: string | null;
    }>();
  if (!rows.results.length) return;
  const result = z
    .object({ data: z.record(z.string(), receiptSchema) })
    .parse(
      await expoRequest(
        "getReceipts",
        { ids: rows.results.map((row) => row.ticket_id) },
        accessToken,
      ),
    );
  for (const row of rows.results) {
    const receipt = result.data[row.ticket_id];
    if (!receipt && now - Date.parse(row.created_at) < 24 * 3600_000) continue;
    const code = receipt?.details?.error ?? (receipt ? null : "ReceiptExpired");
    if (code === "DeviceNotRegistered") await removeDeadDevice(db, row.token);
    await db.batch([
      db
        .prepare(
          "UPDATE push_deliveries SET state = ?, error_code = ? WHERE outbox_id = ? AND token = ?",
        )
        .bind(
          receipt?.status === "ok" ? "delivered" : "failed",
          code,
          row.outbox_id,
          row.token,
        ),
      db
        .prepare("DELETE FROM push_receipts WHERE ticket_id = ?")
        .bind(row.ticket_id),
    ]);
  }
}

/** A lease prevents overlapping Cron invocations from sending the same row. */
export async function dispatchNotifications(
  db: D1Database,
  accessToken?: string,
): Promise<number> {
  const now = new Date().toISOString();
  const due = await db
    .prepare(
      `SELECT id FROM notification_outbox
    WHERE delivered_at IS NULL AND attempts < ? AND next_attempt_at <= ?
    AND (lease_until IS NULL OR lease_until < ?) ORDER BY created_at LIMIT ?`,
    )
    .bind(MAX_ATTEMPTS, now, now, BATCH_SIZE)
    .all<{ id: string }>();
  let accepted = 0;
  for (const candidate of due.results) {
    const row = await db
      .prepare(
        `UPDATE notification_outbox SET lease_until = ?
      WHERE id = ? AND delivered_at IS NULL AND attempts < ?
      AND (lease_until IS NULL OR lease_until < ?) RETURNING id, account_id, kind, attempts`,
      )
      .bind(
        new Date(Date.now() + 120_000).toISOString(),
        candidate.id,
        MAX_ATTEMPTS,
        now,
      )
      .first<OutboxRow>();
    if (!row) continue;
    try {
      await deliverOne(db, row, accessToken);
      accepted += 1;
    } catch {
      const next = new Date(
        Date.now() + Math.min(60, 2 ** (row.attempts + 1)) * 60_000,
      ).toISOString();
      await db
        .prepare(
          "UPDATE notification_outbox SET attempts = attempts + 1, next_attempt_at = ?, lease_until = NULL WHERE id = ?",
        )
        .bind(next, row.id)
        .run();
      console.error(
        JSON.stringify({ event: "push.delivery_failed", kind: row.kind }),
      );
    }
  }
  return accepted;
}
