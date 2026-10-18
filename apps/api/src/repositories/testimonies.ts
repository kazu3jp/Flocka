import { ApiError } from "../http";
import { remoteTestimonySchema, type TestimonyPatch } from "@flocka/domain";
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

export class TestimoniesRepository {
  constructor(private readonly db: D1Database) {}

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
