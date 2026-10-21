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
import {
  toTestimony,
  TestimoniesRepository,
} from "../repositories/testimonies";
import { SyncSnapshotRepository } from "../repositories/sync-snapshot";
import {
  decodeSyncCursor,
  encodeSyncCursor,
  type SyncCursor,
} from "../services/sync-cursor";
import { invalidPRSource } from "../repositories/pr-draft-references";
import { isAdmin } from "../services/admin";
import { hashToken } from "../auth";

const emptyPreferences = { showcase: [], resp: {}, deco: {}, prDraft: null };
export const applicationRoutes = new Hono<ApiContext>();
applicationRoutes.get("/sync", async (c) => {
  const cursorQuery = c.req.query("cursor"),
    cursor = cursorQuery === undefined ? null : decodeSyncCursor(cursorQuery);
  // Page numbers remain for older clients; a cursor continues by keyset instead.
  const page = cursor
      ? 0
      : z.coerce
          .number()
          .int()
          .min(0)
          .max(100000)
          .parse(c.req.query("page") || "0"),
    offset = page * 100;
  const accountId = c.get("accountId"),
    db = c.env.DB,
    accounts = new AccountsRepository(db),
    lists = new SyncSnapshotRepository(db),
    account = await accounts.find(accountId);
  await db
    .prepare(
      "INSERT OR IGNORE INTO player_preferences(account_id, updated_at) VALUES(?, ?)",
    )
    .bind(accountId, new Date().toISOString())
    .run();
  // A list that ended on an earlier cursor page is not read again.
  const ended = (list: keyof SyncCursor) =>
    cursor !== null && cursor[list] === null;
  const [exchanges, inbox, sent, blocks, requests, preferences] =
    await Promise.all([
      ended("exchanges")
        ? []
        : new ExchangesRepository(db).listPage(
            accountId,
            offset,
            cursor?.exchanges ?? null,
          ),
      ended("inbox")
        ? []
        : lists.inbox(accountId, offset, cursor?.inbox ?? null),
      ended("sent") ? [] : lists.sent(accountId, offset, cursor?.sent ?? null),
      ended("blocks")
        ? []
        : lists.blocks(accountId, offset, cursor?.blocks ?? null),
      ended("requests")
        ? []
        : lists.requests(accountId, offset, cursor?.requests ?? null),
      db
        .prepare(
          "SELECT data_json, revision FROM player_preferences WHERE account_id = ?",
        )
        .bind(accountId)
        .first<{ data_json: string; revision: number }>(),
    ]);
  const more = (rows: unknown[]) => rows.length > 100;
  const hasMore = [exchanges, inbox, sent, blocks, requests].some(more);
  const lastRow = (rows: { id: string; created_at: string }[]) =>
    more(rows) ? { at: rows[99].created_at, id: rows[99].id } : null;
  const nextCursor = hasMore
    ? encodeSyncCursor({
        exchanges: more(exchanges)
          ? { at: exchanges[99].createdAt, id: exchanges[99].id }
          : null,
        inbox: lastRow(inbox),
        sent: lastRow(sent),
        requests: lastRow(requests),
        blocks: more(blocks) ? blocks[99].blocked_id : null,
      })
    : null;
  for (const rows of [exchanges, inbox, sent, blocks, requests])
    rows.splice(100);
  const peers = await accounts.listVisiblePlayers(
    [
      ...new Set([
        ...exchanges.map((e) => e.peer.id),
        ...inbox.map((p) => p.sender_id),
        ...sent.map((p) => p.recipient_id),
        ...blocks.map((b) => b.blocked_id),
      ]),
    ],
    accountId,
  );
  return c.json(
    syncSchema.parse({
      nextPage: cursor || !hasMore ? null : page + 1,
      nextCursor,
      player: accounts.toPlayer(account),
      peers,
      exchanges,
      settings: settingsSchema.parse(JSON.parse(account.settings_json)),
      inbox: inbox.map(toTestimony),
      sent: sent.map((p) => ({
        ...toTestimony(p),
        toId: p.recipient_id,
      })),
      blocked: blocks.map((b) => b.blocked_id),
      requests: requests.map((r) =>
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
    `UPDATE player_preferences SET data_json = ?1, revision = revision + 1, updated_at = ?2 WHERE account_id = ?3 AND revision = ?4 AND NOT (${invalidPRSource("?1", "?3")}) RETURNING revision`,
  )
    .bind(
      JSON.stringify(input.data),
      new Date().toISOString(),
      c.get("accountId"),
      input.revision,
    )
    .first<{ revision: number }>();
  if (!result && input.data.prDraftSource) {
    const current = await c.env.DB.prepare(
      "SELECT revision FROM player_preferences WHERE account_id = ?",
    )
      .bind(c.get("accountId"))
      .first<{ revision: number }>();
    if (current?.revision === input.revision)
      throw new ApiError(
        422,
        "PR_SOURCE_UNAVAILABLE",
        "引用元の証言を確認できません。現在の証言から書き出し直してください",
      );
  }
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
  // Same rule as the public profile: accepted exchange, no block either way.
  if (!(await new ExchangesRepository(c.env.DB).isConnected(viewer, id)))
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
  if (!(await exchanges.isConnected(viewer, id)))
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
  const items = await new TestimoniesRepository(c.env.DB).listPublic(
    id,
    viewer,
    page * 100,
  );
  return c.json({
    items: items.slice(0, 100),
    nextPage: items.length > 100 ? page + 1 : null,
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
    // A block hides the exchange (and the peer's profile) like a missing one.
    if (found)
      exchange = await new ExchangesRepository(c.env.DB)
        .get(found.id, owner)
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        });
  }
  return c.json({ expiresAt: row.expires_at, exchange });
});
