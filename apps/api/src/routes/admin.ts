import { Hono } from "hono";
import { z } from "zod";
import { resolveModerationSchema } from "@flocka/domain";
import { ApiError, readJson, type ApiContext } from "../http";
import { isAdmin } from "../services/admin";
import { enqueueNotification } from "../services/notifications";

type PendingRow = {
  id: string;
  testimony_id: string;
  kind: "report" | "deletion";
  reason: string | null;
  created_at: string;
  kind_of_testimony: "vibe" | "proof";
  label: string | null;
  text: string | null;
  story: string | null;
};

export const adminRoutes = new Hono<ApiContext>();
adminRoutes.use("/admin/*", async (c, next) => {
  if (!isAdmin(c.env, c.get("accountId")))
    throw new ApiError(403, "ADMIN_REQUIRED", "運営権限が必要です");
  await next();
});
adminRoutes.get("/admin/moderation", async (c) => {
  const page = z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(c.req.query("page") || "0");
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.testimony_id, m.kind, m.reason, m.created_at, t.kind AS kind_of_testimony, t.label, t.text, t.story
    FROM moderation_requests m JOIN testimonies t ON t.id = m.testimony_id
    WHERE m.status = 'pending' AND m.withdrawn_at IS NULL
    ORDER BY m.created_at, m.id LIMIT 51 OFFSET ?`,
  )
    .bind(page * 50)
    .all<PendingRow>();
  return c.json({
    items: rows.results.slice(0, 50).map((row) => ({
      id: row.id,
      pieceId: row.testimony_id,
      kind: row.kind,
      reason: row.reason,
      at: row.created_at,
      pieceKind: row.kind_of_testimony,
      excerpt: row.label ?? row.text ?? row.story ?? "",
    })),
    nextPage: rows.results.length > 50 ? page + 1 : null,
  });
});
adminRoutes.post("/admin/moderation/:id/resolve", async (c) => {
  const input = await readJson(c, resolveModerationSchema),
    id = c.req.param("id"),
    adminId = c.get("accountId"),
    at = new Date().toISOString();
  const request = await c.env.DB.prepare(
    "SELECT account_id, testimony_id FROM moderation_requests WHERE id = ? AND status = 'pending' AND withdrawn_at IS NULL",
  )
    .bind(id)
    .first<{ account_id: string; testimony_id: string }>();
  if (!request)
    throw new ApiError(
      404,
      "REQUEST_NOT_FOUND",
      "対応待ちの依頼が見つかりません",
    );
  const statements = [
    c.env.DB.prepare(
      "UPDATE moderation_requests SET status = ?, resolution = ?, resolved_at = ?, resolved_by = ? WHERE id = ? AND status = 'pending'",
    ).bind(input.status, input.note, at, adminId, id),
    c.env.DB.prepare(
      "INSERT INTO moderation_audit(id, request_id, admin_id, action, note, created_at) VALUES(?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), id, adminId, input.status, input.note, at),
  ];
  if (input.status === "removed")
    statements.push(
      c.env.DB.prepare(
        "UPDATE testimonies SET removed_at = ? WHERE id = ? AND removed_at IS NULL",
      ).bind(at, request.testimony_id),
    );
  await c.env.DB.batch(statements);
  await enqueueNotification(c.env.DB, request.account_id, "moderation", id);
  return c.json({ id, status: input.status });
});
