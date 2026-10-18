import { BlocksRepository } from "../repositories/blocks";
import { Hono } from "hono";
import { z } from "zod";
import {
  createTestimonySchema,
  moderationSchema,
  settingsSchema,
  testimonyPatchSchema,
} from "@flocka/domain";
import { ApiError, readJson, type ApiContext } from "../http";
import { AccountsRepository } from "../repositories/accounts";
import { ExchangesRepository } from "../repositories/exchanges";

import {
  toTestimony,
  TestimoniesRepository,
  type TestimonyRow,
} from "../repositories/testimonies";
export const testimonyRoutes = new Hono<ApiContext>();
testimonyRoutes.post("/testimonies", async (c) => {
  const input = await readJson(c, createTestimonySchema),
    sender = c.get("accountId"),
    repository = new ExchangesRepository(c.env.DB),
    exchange = await repository.requireParticipant(input.exchangeId, sender);
  if (exchange.status !== "accepted")
    throw new ApiError(
      409,
      "EXCHANGE_NOT_ACCEPTED",
      "双方が交換を承認してから贈れます",
    );
  const recipient =
    exchange.player_a === sender ? exchange.player_b : exchange.player_a;
  if (await repository.isBlocked(sender, recipient))
    throw new ApiError(
      403,
      "RECIPIENT_BLOCKED",
      "このプレイヤーには贈れません",
    );
  const account = await new AccountsRepository(c.env.DB).find(recipient),
    settings = settingsSchema.parse(JSON.parse(account.settings_json));
  if (
    (input.kind === "vibe" && !settings.allowVibe) ||
    (input.kind === "proof" && !settings.allowProof)
  )
    throw new ApiError(
      403,
      "RECEIVING_DISABLED",
      "相手はこの種類の証言を受け取らない設定です",
    );
  const id = crypto.randomUUID(),
    at = new Date().toISOString();
  const insert = c.env.DB.prepare(
    `INSERT OR IGNORE INTO testimonies(id, exchange_id, sender_id, recipient_id, kind, card, label, text, story, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM exchanges WHERE id = ? AND status = 'accepted'
    AND NOT EXISTS(SELECT 1 FROM blocks WHERE (account_id = ? AND blocked_id = ?) OR (account_id = ? AND blocked_id = ?))`,
  ).bind(
    id,
    input.exchangeId,
    sender,
    recipient,
    input.kind,
    input.card,
    input.kind === "vibe" ? input.label : null,
    input.kind === "vibe" ? input.text : null,
    input.kind === "proof" ? input.story : null,
    at,
    input.exchangeId,
    sender,
    recipient,
    recipient,
    sender,
  );
  const [result] = await c.env.DB.batch([
    insert,
    c.env.DB.prepare(
      `INSERT INTO notification_outbox(id, account_id, kind, resource_id, created_at, next_attempt_at)
      SELECT ?, recipient_id, 'testimony', id, ?, ? FROM testimonies WHERE id = ?`,
    ).bind(crypto.randomUUID(), at, at, id),
  ]);
  if (!result.meta.changes)
    throw new ApiError(
      409,
      "TESTIMONY_CONFLICT",
      "印象は1人に1つまでです。交換やブロックの状態も確認してください",
    );
  return c.json({ id }, 201);
});
testimonyRoutes.get("/testimonies", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM testimonies AS testimony WHERE recipient_id = ? AND removed_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM blocks WHERE account_id = testimony.recipient_id AND blocked_id = testimony.sender_id)
    ORDER BY created_at DESC, id DESC LIMIT 200`,
  )
    .bind(c.get("accountId"))
    .all<TestimonyRow>();
  return c.json({ items: rows.results.map(toTestimony) });
});
testimonyRoutes.patch("/testimonies/:id", async (c) => {
  const patch = await readJson(c, testimonyPatchSchema);
  const updated = await new TestimoniesRepository(c.env.DB).updateOwn(
    c.req.param("id"),
    c.get("accountId"),
    patch,
  );
  return c.json(toTestimony(updated));
});
testimonyRoutes.post("/blocks", async (c) => {
  const { playerId } = await readJson(
      c,
      z.object({ playerId: z.string().uuid() }),
    ),
    accountId = c.get("accountId");
  if (playerId === accountId)
    throw new ApiError(422, "SELF_BLOCK", "自分はブロックできません");
  await new AccountsRepository(c.env.DB).find(playerId);
  return c.json(
    await new BlocksRepository(c.env.DB).create(accountId, playerId),
  );
});
testimonyRoutes.delete("/blocks/:id", async (c) => {
  const undoToken = z
    .string()
    .min(1)
    .max(100)
    .optional()
    .parse(c.req.query("undoToken"));
  return c.json(
    await new BlocksRepository(c.env.DB).remove(
      c.get("accountId"),
      c.req.param("id"),
      undoToken,
    ),
  );
});
testimonyRoutes.post("/moderation", async (c) => {
  const input = await readJson(c, moderationSchema),
    accountId = c.get("accountId");
  const owns = await c.env.DB.prepare(
    "SELECT id FROM testimonies WHERE id = ? AND recipient_id = ? AND removed_at IS NULL",
  )
    .bind(input.pieceId, accountId)
    .first();
  if (!owns)
    throw new ApiError(404, "TESTIMONY_NOT_FOUND", "証言が見つかりません");
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO moderation_requests(id, account_id, testimony_id, kind, reason, created_at) VALUES(?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      accountId,
      input.pieceId,
      input.kind,
      input.reason || null,
      new Date().toISOString(),
    )
    .run();
  return c.json({ id }, 201);
});
testimonyRoutes.post("/moderation/:id/withdraw", async (c) => {
  const result = await c.env.DB.prepare(
    "UPDATE moderation_requests SET withdrawn_at = ? WHERE id = ? AND account_id = ? AND status = 'pending'",
  )
    .bind(new Date().toISOString(), c.req.param("id"), c.get("accountId"))
    .run();
  if (!result.meta.changes)
    throw new ApiError(404, "REQUEST_NOT_FOUND", "依頼が見つかりません");
  return c.json({ withdrawn: true });
});
