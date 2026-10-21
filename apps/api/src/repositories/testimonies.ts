import { ApiError } from "../http";
import {
  publicTestimonySchema,
  remoteTestimonySchema,
  type CreateTestimony,
  type TestimonyPatch,
} from "@flocka/domain";
import { noBlockBetween } from "./exchanges";

/**
 * Scene memos are not limited to one per person (impressions are), but each
 * one notifies the recipient. A per-pair window bounds repeated sends.
 */
export const PROOF_LIMIT_PER_PAIR = 5;
export const PROOF_LIMIT_WINDOW_HOURS = 24;
const proofWindowStart = (at: Date) =>
  new Date(at.getTime() - PROOF_LIMIT_WINDOW_HOURS * 3600_000).toISOString();

export type TestimonyRow = {
  id: string;
  exchange_id: string;
  sender_id: string;
  recipient_id: string;
  kind: "vibe" | "proof";
  card: string;
  label: string | null;
  text: string | null;
  story: string | null;
  opened: number;
  guess: string | null;
  visibility: "private" | "public" | "hidden";
  visibility_revision: number;
  created_at: string;
};
export const toTestimony = (row: TestimonyRow) =>
  remoteTestimonySchema.parse({
    id: row.id,
    fromId: row.sender_id,
    exchangeId: row.exchange_id,
    kind: row.kind,
    card: row.card,
    label: row.label,
    text: row.text,
    story: row.story,
    opened: row.opened === 1,
    guess: row.guess,
    visibility: row.visibility,
    visibilityRevision: row.visibility_revision,
    createdAt: row.created_at,
  });

type PublicTestimonyRow = Pick<
  TestimonyRow,
  "id" | "kind" | "card" | "label" | "text" | "story" | "created_at"
> & { giver: number };

export class TestimoniesRepository {
  constructor(private readonly db: D1Database) {}

  async recentProofCount(sender: string, recipient: string, at: Date) {
    const row = await this.db
      .prepare(
        "SELECT COUNT(*) AS count FROM testimonies WHERE sender_id = ? AND recipient_id = ? AND kind = 'proof' AND created_at > ?",
      )
      .bind(sender, recipient, proofWindowStart(at))
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  /**
   * Inserts the testimony and its notification atomically. Exchange status,
   * blocks, the recipient's receiving setting and the memo limit are evaluated
   * inside the INSERT, so a concurrent change is respected. Returns null when
   * any condition (or the one-impression index) refused the row.
   */
  async create(
    input: CreateTestimony & { sender: string; recipient: string; at: Date },
  ): Promise<string | null> {
    const id = crypto.randomUUID(),
      at = input.at.toISOString();
    const [result] = await this.db.batch([
      this.db
        .prepare(
          `INSERT OR IGNORE INTO testimonies(id, exchange_id, sender_id, recipient_id, kind, card, label, text, story, created_at)
          SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10 FROM exchanges WHERE id = ?2 AND status = 'accepted'
          AND ((player_a = ?3 AND player_b = ?4) OR (player_a = ?4 AND player_b = ?3))
          AND ${noBlockBetween("?3", "?4")}
          AND EXISTS(SELECT 1 FROM accounts WHERE id = ?4
            AND json_extract(settings_json, CASE ?5 WHEN 'vibe' THEN '$.allowVibe' ELSE '$.allowProof' END) = 1)
          AND (?5 != 'proof' OR (SELECT COUNT(*) FROM testimonies WHERE sender_id = ?3 AND recipient_id = ?4
            AND kind = 'proof' AND created_at > ?11) < ?12)`,
        )
        .bind(
          id,
          input.exchangeId,
          input.sender,
          input.recipient,
          input.kind,
          input.card,
          input.kind === "vibe" ? input.label : null,
          input.kind === "vibe" ? input.text : null,
          input.kind === "proof" ? input.story : null,
          at,
          proofWindowStart(input.at),
          PROOF_LIMIT_PER_PAIR,
        ),
      this.db
        .prepare(
          `INSERT INTO notification_outbox(id, account_id, kind, resource_id, created_at, next_attempt_at)
          SELECT ?, recipient_id, 'testimony', id, ?, ? FROM testimonies WHERE id = ?`,
        )
        .bind(crypto.randomUUID(), at, at, id),
    ]);
    return result.meta.changes ? id : null;
  }

  /**
   * Public testimonies of `recipientId` as `viewerId` sees them. Blocks between
   * the recipient and a sender, or the viewer and a sender, hide the item.
   * Givers are numbered by first appearance so equal senders can be counted
   * without exposing who they are.
   */
  async listPublic(recipientId: string, viewerId: string, offset: number) {
    const hidden = (a: string, b: string) =>
      `EXISTS(SELECT 1 FROM blocks WHERE (account_id = ${a} AND blocked_id = ${b}) OR (account_id = ${b} AND blocked_id = ${a}))`;
    const rows = await this.db
      .prepare(
        `WITH visible AS (
          SELECT * FROM testimonies AS t WHERE recipient_id = ?1 AND opened = 1 AND visibility = 'public' AND removed_at IS NULL
          AND NOT ${hidden("t.recipient_id", "t.sender_id")} AND NOT ${hidden("?2", "t.sender_id")}
        ), givers AS (
          SELECT sender_id, ROW_NUMBER() OVER (ORDER BY MIN(created_at), MIN(id)) AS giver FROM visible GROUP BY sender_id
        )
        SELECT v.id, v.kind, v.card, v.label, v.text, v.story, v.created_at, g.giver
        FROM visible AS v JOIN givers AS g ON g.sender_id = v.sender_id
        ORDER BY v.created_at DESC, v.id DESC LIMIT 101 OFFSET ?3`,
      )
      .bind(recipientId, viewerId, offset)
      .all<PublicTestimonyRow>();
    return rows.results.map((row) =>
      publicTestimonySchema.parse({
        id: row.id,
        kind: row.kind,
        card: row.card,
        label: row.label,
        text: row.text,
        story: row.story,
        createdAt: row.created_at,
        giver: String(row.giver),
      }),
    );
  }

  async updateOwn(id: string, accountId: string, patch: TestimonyPatch) {
    const current = await this.db
      .prepare(
        "SELECT * FROM testimonies WHERE id = ? AND recipient_id = ? AND removed_at IS NULL",
      )
      .bind(id, accountId)
      .first<TestimonyRow>();
    if (!current)
      throw new ApiError(404, "TESTIMONY_NOT_FOUND", "証言が見つかりません");
    if (patch.guess && !patch.opened)
      throw new ApiError(
        422,
        "OPEN_REQUIRED",
        "予想は開封と一緒に記録してください",
      );
    // Read unchanged columns inside this UPDATE, so opening cannot restore stale visibility.
    const updated = await this.db
      .prepare(
        `UPDATE testimonies SET
      opened = MAX(opened, ?),
      guess = CASE WHEN opened = 1 THEN guess ELSE COALESCE(?, guess) END,
      visibility = COALESCE(?, visibility),
      visibility_revision = visibility_revision + CASE WHEN ? IS NOT NULL AND visibility != ? THEN 1 ELSE 0 END
      WHERE id = ? AND recipient_id = ? AND removed_at IS NULL
      AND (? IS NULL OR visibility_revision = ?) RETURNING *`,
      )
      .bind(
        patch.opened ? 1 : 0,
        patch.guess ?? null,
        patch.visibility ?? null,
        patch.visibility ?? null,
        patch.visibility ?? null,
        id,
        accountId,
        patch.expectedVisibilityRevision ?? null,
        patch.expectedVisibilityRevision ?? null,
      )
      .first<TestimonyRow>();
    if (!updated) {
      if (patch.expectedVisibilityRevision !== undefined)
        throw new ApiError(
          409,
          "VISIBILITY_CONFLICT",
          "別の端末で公開範囲が変わりました。最新の内容を確認してください",
        );
      throw new ApiError(404, "TESTIMONY_NOT_FOUND", "証言が見つかりません");
    }
    return updated;
  }
}
