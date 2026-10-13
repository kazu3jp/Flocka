import { Hono } from "hono";
import { z } from "zod";
import {
  preferencesSchema,
  remoteRequestSchema,
  settingsSchema,
  syncSchema,
  createExchangeSchema,
} from "@flocka/domain";
import { ApiError, readJson, type ApiContext } from "../http";
import { AccountsRepository } from "../repositories/accounts";
import { ExchangesRepository } from "../repositories/exchanges";
import { toTestimony, type TestimonyRow } from "../repositories/testimonies";
import { isAdmin } from "../services/admin";
import { hashToken } from "../auth";

const emptyPreferences = { showcase: [], resp: {}, deco: {}, prDraft: null };
export const applicationRoutes = new Hono<ApiContext>();
applicationRoutes.get("/sync", async (c) => {
  const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .parse(c.req.query("page") || "0"),
    offset = page * 100;
  const accountId = c.get("accountId"),
    db = c.env.DB,
    accounts = new AccountsRepository(db),
    account = await accounts.find(accountId);
  await db
    .prepare(
      "INSERT OR IGNORE INTO player_preferences(account_id, updated_at) VALUES(?, ?)",
    )
    .bind(accountId, new Date().toISOString())
    .run();
  const [exchanges, inbox, sent, blocks, requests, preferences] =
    await Promise.all([
      new ExchangesRepository(db).listPage(accountId, offset),
      db
        .prepare(
          "SELECT * FROM testimonies AS testimony WHERE recipient_id = ? AND removed_at IS NULL AND NOT EXISTS(SELECT 1 FROM blocks WHERE (account_id = testimony.recipient_id AND blocked_id = testimony.sender_id) OR (account_id = testimony.sender_id AND blocked_id = testimony.recipient_id)) ORDER BY created_at DESC, id DESC LIMIT 101 OFFSET ?",
        )
        .bind(accountId, offset)
        .all<TestimonyRow>(),
      db
        .prepare(
          "SELECT * FROM testimonies WHERE sender_id = ? AND removed_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 101 OFFSET ?",
        )
        .bind(accountId, offset)
        .all<TestimonyRow>(),
      db
        .prepare(
          "SELECT blocked_id FROM blocks WHERE account_id = ? ORDER BY blocked_id LIMIT 101 OFFSET ?",
        )
        .bind(accountId, offset)
        .all<{ blocked_id: string }>(),
      db
        .prepare(
          "SELECT * FROM moderation_requests WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT 101 OFFSET ?",
        )
        .bind(accountId, offset)
        .all<{
          id: string;
          testimony_id: string;
          kind: "report" | "deletion";
          reason: string | null;
          created_at: string;
          withdrawn_at: string | null;
          status: string;
          resolution: string | null;
        }>(),
      db
        .prepare(
          "SELECT data_json, revision FROM player_preferences WHERE account_id = ?",
        )
        .bind(accountId)
        .first<{ data_json: string; revision: number }>(),
    ]);
  const nextPage = [
    exchanges.length,
    inbox.results.length,
    sent.results.length,
    blocks.results.length,
    requests.results.length,
  ].some((length) => length > 100)
    ? page + 1
    : null;
  exchanges.splice(100);
  inbox.results.splice(100);
  sent.results.splice(100);
  blocks.results.splice(100);
  requests.results.splice(100);
  const peerIds = new Set([
    ...exchanges.map((e) => e.peer.id),
    ...inbox.results.map((p) => p.sender_id),
    ...sent.results.map((p) => p.recipient_id),
    ...blocks.results.map((b) => b.blocked_id),
  ]);
  const peers = [];
  for (const id of peerIds) peers.push(await accounts.getPlayer(id));
  return c.json(
    syncSchema.parse({
      nextPage,
      player: accounts.toPlayer(account),
      peers,
      exchanges,
      settings: settingsSchema.parse(JSON.parse(account.settings_json)),
      inbox: inbox.results.map(toTestimony),
      sent: sent.results.map((p) => ({
        ...toTestimony(p),
        toId: p.recipient_id,
      })),
      blocked: blocks.results.map((b) => b.blocked_id),
      requests: requests.results.map((r) =>
        remoteRequestSchema.parse({
          id: r.id,
          pieceId: r.testimony_id,
          kind: r.kind,
          reason: r.reason,
          at: r.created_at,
          withdrawn: r.withdrawn_at !== null,
          status: r.status,
          resolution: r.resolution,
        }),
      ),
      preferences: {
        data: preferences
          ? JSON.parse(preferences.data_json)
          : emptyPreferences,
        revision: preferences?.revision || 1,
      },
      isAdmin: isAdmin(c.env, accountId),
    }),
  );
});
applicationRoutes.put("/me/preferences", async (c) => {
  const input = await readJson(
    c,
    z.object({ data: preferencesSchema, revision: z.number().int().min(1) }),
  );
  const result = await c.env.DB.prepare(
    "UPDATE player_preferences SET data_json = ?, revision = revision + 1, updated_at = ? WHERE account_id = ? AND revision = ? RETURNING revision",
  )
    .bind(
      JSON.stringify(input.data),
      new Date().toISOString(),
      c.get("accountId"),
      input.revision,
    )
    .first<{ revision: number }>();
  if (!result)
    throw new ApiError(
      409,
      "PREFERENCES_CONFLICT",
      "別の端末で更新されています。同期して最新の内容を確認してください",
    );
  return c.json({ data: input.data, revision: result.revision });
});
applicationRoutes.post("/invites/preview", async (c) => {
  const { code } = await readJson(c, createExchangeSchema),
    id = c.get("accountId");
  const invite = await c.env.DB.prepare(
    "SELECT account_id FROM invites WHERE code_hash = ? AND expires_at > ? AND (used_by IS NULL OR used_by = ?)",
  )
    .bind(await hashToken(code), new Date().toISOString(), id)
    .first<{ account_id: string }>();
  if (!invite || invite.account_id === id)
    throw new ApiError(
      404,
      "INVITE_EXPIRED",
      "交換コードが期限切れ、または無効です",
    );
  if (await new ExchangesRepository(c.env.DB).isBlocked(id, invite.account_id))
    throw new ApiError(
      403,
      "EXCHANGE_BLOCKED",
      "このプレイヤーとは交換できません",
    );
  return c.json(
    await new AccountsRepository(c.env.DB).getPlayer(invite.account_id),
  );
});
applicationRoutes.get("/players/:id/avatar", async (c) => {
  const id = c.req.param("id"),
    viewer = c.get("accountId");
  const connected = await c.env.DB.prepare(
    "SELECT 1 FROM exchanges WHERE (player_a = ? AND player_b = ?) OR (player_a = ? AND player_b = ?) LIMIT 1",
  )
    .bind(id, viewer, viewer, id)
    .first();
  if (
    !connected ||
    (await new ExchangesRepository(c.env.DB).isBlocked(id, viewer))
  )
    throw new ApiError(404, "PLAYER_NOT_FOUND", "プレイヤーが見つかりません");
  const player = await new AccountsRepository(c.env.DB).find(id);
  if (!player.avatar_key)
    throw new ApiError(404, "AVATAR_NOT_FOUND", "写真がありません");
  const object = await c.env.AVATARS.get(player.avatar_key);
  if (!object) throw new ApiError(404, "AVATAR_NOT_FOUND", "写真がありません");
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
applicationRoutes.get("/players/:id/public", async (c) => {
  const id = c.req.param("id"),
    viewer = c.get("accountId"),
    exchanges = new ExchangesRepository(c.env.DB);
  if (await exchanges.isBlocked(id, viewer))
    throw new ApiError(404, "PLAYER_NOT_FOUND", "プレイヤーが見つかりません");
  const connected = await c.env.DB.prepare(
    "SELECT 1 FROM exchanges WHERE status = 'accepted' AND ((player_a = ? AND player_b = ?) OR (player_a = ? AND player_b = ?)) LIMIT 1",
  )
    .bind(id, viewer, viewer, id)
    .first();
  if (!connected)
    throw new ApiError(
      403,
      "CONNECTION_REQUIRED",
      "交換した相手だけが閲覧できます",
    );
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(c.req.query("page") || "0");
  const rows = await c.env.DB.prepare(
    "SELECT * FROM testimonies WHERE recipient_id = ? AND opened = 1 AND visibility = 'public' AND removed_at IS NULL AND NOT EXISTS(SELECT 1 FROM blocks WHERE account_id = ? AND blocked_id = sender_id) ORDER BY created_at DESC, id DESC LIMIT 101 OFFSET ?",
  )
    .bind(id, id, page * 100)
    .all<TestimonyRow>();
  return c.json({
    items: rows.results.slice(0, 100).map(toTestimony),
    nextPage: rows.results.length > 100 ? page + 1 : null,
  });
});

applicationRoutes.post("/invites/status", async (c) => {
  const { code } = await readJson(c, createExchangeSchema),
    owner = c.get("accountId");
  const row = await c.env.DB.prepare(
    "SELECT expires_at, used_by FROM invites WHERE code_hash = ? AND account_id = ?",
  )
    .bind(await hashToken(code), owner)
    .first<{ expires_at: string; used_by: string | null }>();
  if (!row)
    throw new ApiError(404, "INVITE_NOT_FOUND", "交換コードが見つかりません");
  let exchange = null;
  if (row.used_by) {
    const [a, b] = [owner, row.used_by].sort();
    const found = await c.env.DB.prepare(
      "SELECT id FROM exchanges WHERE player_a = ? AND player_b = ? AND status != 'cancelled'",
    )
      .bind(a, b)
      .first<{ id: string }>();
    if (found)
      exchange = await new ExchangesRepository(c.env.DB).get(found.id, owner);
  }
  return c.json({ expiresAt: row.expires_at, exchange });
});
