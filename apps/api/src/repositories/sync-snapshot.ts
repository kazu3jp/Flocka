import type { TestimonyRow } from "./testimonies";
import type { SyncPosition } from "../services/sync-cursor";

export type RequestRow = {
  id: string;
  testimony_id: string;
  kind: "report" | "deletion";
  reason: string | null;
  created_at: string;
  withdrawn_at: string | null;
  status: string;
  resolution: string | null;
};
/** Newest first. A position continues strictly after the last returned row. */
const after = "(?2 IS NULL OR (created_at, id) < (?2, ?3))";
const page = "ORDER BY created_at DESC, id DESC LIMIT 101 OFFSET ?4";

/**
 * Sync lists for one account. Each method returns up to 101 rows so the caller
 * can tell whether another page exists. `offset` serves page-numbered clients;
 * `position` serves keyset clients and is used with offset 0.
 */
export class SyncSnapshotRepository {
  constructor(private readonly db: D1Database) {}
  private bindPage(
    statement: D1PreparedStatement,
    accountId: string,
    offset: number,
    position: SyncPosition | null,
  ) {
    return statement.bind(
      accountId,
      position?.at ?? null,
      position?.id ?? null,
      offset,
    );
  }
  async inbox(
    accountId: string,
    offset: number,
    position: SyncPosition | null,
  ) {
    const rows = await this.bindPage(
      this.db.prepare(
        `SELECT * FROM testimonies AS testimony WHERE recipient_id = ?1 AND removed_at IS NULL
        AND NOT EXISTS(SELECT 1 FROM blocks WHERE (account_id = testimony.recipient_id AND blocked_id = testimony.sender_id) OR (account_id = testimony.sender_id AND blocked_id = testimony.recipient_id))
        AND ${after} ${page}`,
      ),
      accountId,
      offset,
      position,
    ).all<TestimonyRow>();
    return rows.results;
  }
  async sent(accountId: string, offset: number, position: SyncPosition | null) {
    const rows = await this.bindPage(
      this.db.prepare(
        `SELECT * FROM testimonies WHERE sender_id = ?1 AND removed_at IS NULL AND ${after} ${page}`,
      ),
      accountId,
      offset,
      position,
    ).all<TestimonyRow>();
    return rows.results;
  }
  async requests(
    accountId: string,
    offset: number,
    position: SyncPosition | null,
  ) {
    const rows = await this.bindPage(
      this.db.prepare(
        `SELECT * FROM moderation_requests WHERE account_id = ?1 AND ${after} ${page}`,
      ),
      accountId,
      offset,
      position,
    ).all<RequestRow>();
    return rows.results;
  }
  async blocks(accountId: string, offset: number, afterId: string | null) {
    const rows = await this.db
      .prepare(
        "SELECT blocked_id FROM blocks WHERE account_id = ?1 AND (?2 IS NULL OR blocked_id > ?2) ORDER BY blocked_id LIMIT 101 OFFSET ?3",
      )
      .bind(accountId, afterId, offset)
      .all<{ blocked_id: string }>();
    return rows.results;
  }
}
