import { Hono } from "hono";
import {
  moderationCursorSchema,
  resolveModerationSchema,
  type ModerationCursor,
} from "@flocka/domain";
import { ApiError, readJson, type ApiContext } from "../http";
import { isAdmin } from "../services/admin";

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
  const afterAt = c.req.query("afterAt"),
    afterId = c.req.query("afterId");
  let after: ModerationCursor | null = null;
  if (afterAt !== undefined || afterId !== undefined) {
    const parsed = moderationCursorSchema.safeParse({
      at: afterAt,
      id: afterId,
    });
    if (!parsed.success)
      throw new ApiError(
        422,
        "INVALID_INPUT",
        "読み込み位置を確認できませんでした",
      );
    after = parsed.data;
  }
  // Keyset paging: resolved requests leave the list without shifting later ones.
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.testimony_id, m.kind, m.reason, m.created_at, t.kind AS kind_of_testimony, t.label, t.text, t.story
    FROM moderation_requests m JOIN testimonies t ON t.id = m.testimony_id
    WHERE m.status = 'pending' AND m.withdrawn_at IS NULL
      AND (?1 IS NULL OR m.created_at > ?1 OR (m.created_at = ?1 AND m.id > ?2))
    ORDER BY m.created_at, m.id LIMIT 51`,
  )
    .bind(after?.at ?? null, after?.id ?? null)
    .all<PendingRow>();
  const last = rows.results[49];
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
    next:
      rows.results.length > 50 ? { at: last.created_at, id: last.id } : null,
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
  const auditId = crypto.randomUUID();
  // The audit insert claims a still-pending request inside the same transaction.
  // Every following mutation is conditional on this invocation owning that claim.
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO moderation_audit(id, request_id, admin_id, action, note, created_at)
      SELECT ?, id, ?, ?, ?, ? FROM moderation_requests
      WHERE id = ? AND status = 'pending' AND withdrawn_at IS NULL`,
    ).bind(auditId, adminId, input.status, input.note, at, id),
    c.env.DB.prepare(
      `UPDATE moderation_requests SET status = ?, resolution = ?, resolved_at = ?, resolved_by = ?
      WHERE id = ? AND EXISTS(SELECT 1 FROM moderation_audit WHERE id = ?)`,
    ).bind(input.status, input.note, at, adminId, id, auditId),
  ];
  if (input.status === "removed")
    statements.push(
      c.env.DB.prepare(
        `UPDATE testimonies SET removed_at = ? WHERE id = ? AND removed_at IS NULL
      AND EXISTS(SELECT 1 FROM moderation_audit WHERE id = ?)`,
      ).bind(at, request.testimony_id, auditId),
    );
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO notification_outbox(id, account_id, kind, resource_id, created_at, next_attempt_at)
    SELECT ?, ?, 'moderation', ?, ?, ? WHERE EXISTS(SELECT 1 FROM moderation_audit WHERE id = ?)`,
    ).bind(crypto.randomUUID(), request.account_id, id, at, at, auditId),
  );
  const results = await c.env.DB.batch(statements);
  if (!results[0].meta.changes)
    throw new ApiError(
      409,
      "REQUEST_RESOLVED",
      "この依頼は対応済み、または取り下げられています",
    );
  return c.json({ id, status: input.status });
});
