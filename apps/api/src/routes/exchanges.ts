import { Hono } from "hono";
import { createExchangeSchema, meetingContextSchema } from "@flocka/domain";
import { hashToken, randomToken } from "../auth";
import { ApiError, readJson, type ApiContext } from "../http";
import {
  ExchangesRepository,
  noBlockBetween,
  type ExchangeRow,
} from "../repositories/exchanges";

const INVITE_LIFETIME_MS = 10 * 60 * 1000;
export const exchangeRoutes = new Hono<ApiContext>();
exchangeRoutes.post("/invites", async (c) => {
  const code = randomToken(),
    expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO invites(code_hash, account_id, expires_at) VALUES(?, ?, ?)",
  )
    .bind(await hashToken(code), c.get("accountId"), expiresAt)
    .run();
  return c.json({ code, expiresAt }, 201);
});
exchangeRoutes.post("/exchanges", async (c) => {
  const { code } = await readJson(c, createExchangeSchema),
    hash = await hashToken(code),
    accountId = c.get("accountId"),
    at = new Date().toISOString(),
    repository = new ExchangesRepository(c.env.DB);
  const invite = await c.env.DB.prepare(
    "SELECT account_id, used_by, expires_at FROM invites WHERE code_hash = ?",
  )
    .bind(hash)
    .first<{
      account_id: string;
      used_by: string | null;
      expires_at: string;
    }>();
  if (!invite || invite.expires_at <= at)
    throw new ApiError(
      404,
      "INVITE_EXPIRED",
      "交換用のQRが無効、または期限切れです",
    );
  if (invite.account_id === accountId)
    throw new ApiError(422, "SELF_EXCHANGE", "自分とは交換できません");
  if (invite.used_by && invite.used_by !== accountId)
    throw new ApiError(409, "INVITE_USED", "この交換用QRは使用済みです");
  if (await repository.isBlocked(accountId, invite.account_id))
    throw new ApiError(
      403,
      "EXCHANGE_BLOCKED",
      "このプレイヤーとは交換できません",
    );
  const [first, second] = [accountId, invite.account_id].sort();
  const existing = await c.env.DB.prepare(
    "SELECT id FROM exchanges WHERE player_a = ? AND player_b = ? AND status != 'cancelled'",
  )
    .bind(first, second)
    .first<{ id: string }>();
  if (existing) return c.json(await repository.get(existing.id, accountId));
  const id = crypto.randomUUID();
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO exchanges(id, player_a, player_b, created_at)
      SELECT ?, ?, ?, ? FROM invites WHERE code_hash = ? AND used_by IS NULL AND expires_at > ?
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (account_id = ? AND blocked_id = ?) OR (account_id = ? AND blocked_id = ?))`,
    ).bind(id, first, second, at, hash, at, first, second, second, first),
    c.env.DB.prepare(
      "INSERT INTO exchange_participants(exchange_id, account_id) SELECT id, player_a FROM exchanges WHERE id = ?",
    ).bind(id),
    c.env.DB.prepare(
      "INSERT INTO exchange_participants(exchange_id, account_id) SELECT id, player_b FROM exchanges WHERE id = ?",
    ).bind(id),
    c.env.DB.prepare(
      "UPDATE invites SET used_by = ?, used_at = ? WHERE code_hash = ? AND used_by IS NULL AND EXISTS(SELECT 1 FROM exchanges WHERE id = ?)",
    ).bind(accountId, at, hash, id),
  ]);
  if (!results[0].meta.changes)
    throw new ApiError(
      409,
      "EXCHANGE_CONFLICT",
      "交換の状態が更新されました。もう一度確認してください",
    );
  return c.json(await repository.get(id, accountId), 201);
});
exchangeRoutes.get("/exchanges", async (c) =>
  c.json({
    items: await new ExchangesRepository(c.env.DB).list(c.get("accountId")),
  }),
);
exchangeRoutes.get("/exchanges/:id", async (c) =>
  c.json(
    await new ExchangesRepository(c.env.DB).get(
      c.req.param("id"),
      c.get("accountId"),
    ),
  ),
);
exchangeRoutes.post("/exchanges/:id/approve", async (c) => {
  const context = await readJson(c, meetingContextSchema),
    accountId = c.get("accountId"),
    id = c.req.param("id"),
    repository = new ExchangesRepository(c.env.DB),
    exchange = await repository.requireParticipant(id, accountId);
  const rejectInactive = async (current: ExchangeRow) => {
    if (current.status === "cancelled")
      throw new ApiError(
        409,
        "EXCHANGE_CANCELLED",
        "この交換はキャンセルされています",
      );
    if (await repository.isBlocked(current.player_a, current.player_b))
      throw new ApiError(
        403,
        "EXCHANGE_BLOCKED",
        "このプレイヤーとは交換できません",
      );
  };
  await rejectInactive(exchange);
  const at = new Date().toISOString();
  // Every write re-checks status and blocks, so a concurrent cancel or block wins.
  const active = `EXISTS(SELECT 1 FROM exchanges AS e WHERE e.id = ?1 AND e.status != 'cancelled' AND ${noBlockBetween("e.player_a", "e.player_b")})`;
  const bothApproved =
    "(SELECT COUNT(*) FROM exchange_participants WHERE exchange_id = ?1 AND approved_at IS NOT NULL) = 2";
  const notify = (player: "player_a" | "player_b") =>
    c.env.DB.prepare(
      `INSERT INTO notification_outbox(id, account_id, kind, resource_id, created_at, next_attempt_at)
      SELECT ?2, ${player}, 'exchange', id, ?3, ?3 FROM exchanges WHERE id = ?1 AND status = 'pending'
      AND ${bothApproved} AND ${active}`,
    ).bind(id, crypto.randomUUID(), at);
  const [approval] = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE exchange_participants SET approved_at = COALESCE(approved_at, ?2), place = ?3, trigger = ?4
      WHERE exchange_id = ?1 AND account_id = ?5 AND ${active}`,
    ).bind(id, at, context.place, context.trigger, accountId),
    notify("player_a"),
    notify("player_b"),
    c.env.DB.prepare(
      `UPDATE exchanges SET status = 'accepted' WHERE id = ?1 AND status = 'pending'
      AND ${bothApproved} AND ${active}`,
    ).bind(id),
  ]);
  if (!approval.meta.changes) {
    await rejectInactive(await repository.requireParticipant(id, accountId));
    throw new ApiError(
      409,
      "EXCHANGE_CONFLICT",
      "交換の状態が更新されました。もう一度確認してください",
    );
  }
  return c.json(await repository.get(id, accountId));
});
exchangeRoutes.post("/exchanges/:id/cancel", async (c) =>
  c.json(
    await new ExchangesRepository(c.env.DB).cancel(
      c.req.param("id"),
      c.get("accountId"),
    ),
  ),
);
