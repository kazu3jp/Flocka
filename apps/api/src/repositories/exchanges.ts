import { type RemoteExchange } from "@flocka/domain";
import { ApiError } from "../http";
import { AccountsRepository, type AccountRow } from "./accounts";

export type ExchangeRow = {
  id: string;
  player_a: string;
  player_b: string;
  status: "pending" | "accepted" | "cancelled";
  created_at: string;
};
type ExchangeViewRow = ExchangeRow & {
  my_approved: string | null;
  peer_approved: string | null;
  place: string;
  trigger: string;
  peer_id: string;
  profile_json: string;
  self_json: string;
  settings_json: string;
  avatar_key: string | null;
  peer_created_at: string;
  peer_sns_links_json: string;
};
/** Keyset position in the newest-first exchange list. */
export type ExchangePosition = { at: string; id: string };

/** SQL condition: no block exists between the two account expressions, in either direction. */
export function noBlockBetween(first: string, second: string): string {
  return `NOT EXISTS(SELECT 1 FROM blocks WHERE (account_id = ${first} AND blocked_id = ${second}) OR (account_id = ${second} AND blocked_id = ${first}))`;
}

// ?1 is always the viewer. The participant index starts the join from the viewer's rows.
const viewQuery = `
  SELECT exchange.*, mine.approved_at AS my_approved, theirs.approved_at AS peer_approved,
    mine.place, mine.trigger, peer.id AS peer_id, peer.profile_json, peer.self_json,
    peer.settings_json, peer.avatar_key, peer.created_at AS peer_created_at, peer.sns_links_json AS peer_sns_links_json
  FROM exchange_participants AS mine
  JOIN exchanges AS exchange ON exchange.id = mine.exchange_id
  JOIN exchange_participants AS theirs ON theirs.exchange_id = exchange.id AND theirs.account_id != mine.account_id
  JOIN accounts AS peer ON peer.id = theirs.account_id
  WHERE mine.account_id = ?1
`;
/**
 * A peer's live profile is shared only through an exchange that is still active
 * and not hidden by a block in either direction.
 */
const visibleToViewer = `exchange.status != 'cancelled' AND ${noBlockBetween("mine.account_id", "theirs.account_id")}`;
const newestFirst = "ORDER BY exchange.created_at DESC, exchange.id DESC";

export class ExchangesRepository {
  constructor(private readonly db: D1Database) {}
  async requireParticipant(
    id: string,
    accountId: string,
  ): Promise<ExchangeRow> {
    const row = await this.db
      .prepare(
        "SELECT * FROM exchanges WHERE id = ? AND (player_a = ? OR player_b = ?)",
      )
      .bind(id, accountId, accountId)
      .first<ExchangeRow>();
    if (!row)
      throw new ApiError(404, "EXCHANGE_NOT_FOUND", "交換が見つかりません");
    return row;
  }
  async isBlocked(first: string, second: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        "SELECT 1 AS blocked FROM blocks WHERE (account_id = ? AND blocked_id = ?) OR (account_id = ? AND blocked_id = ?) LIMIT 1",
      )
      .bind(first, second, second, first)
      .first();
    return row !== null;
  }
  /** Accepted exchange and no block in either direction. */
  async isConnected(viewer: string, peer: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT 1 AS connected FROM exchanges WHERE status = 'accepted'
        AND ((player_a = ?1 AND player_b = ?2) OR (player_a = ?2 AND player_b = ?1))
        AND ${noBlockBetween("?1", "?2")} LIMIT 1`,
      )
      .bind(viewer, peer)
      .first();
    return row !== null;
  }
  private toView(row: ExchangeViewRow): RemoteExchange {
    const peer: AccountRow = {
      id: row.peer_id,
      profile_json: row.profile_json,
      self_json: row.self_json,
      settings_json: row.settings_json,
      avatar_key: row.avatar_key,
      created_at: row.peer_created_at,
      sns_links_json: row.peer_sns_links_json,
    };
    return {
      id: row.id,
      status: row.status,
      myApproved: row.my_approved !== null,
      peerApproved: row.peer_approved !== null,
      context: { place: row.place, trigger: row.trigger },
      // Self-declared SNS links are for accepted exchanges only, not a pending scan.
      peer: new AccountsRepository(this.db).toPlayer(
        peer,
        row.status === "accepted",
      ),
      createdAt: row.created_at,
    };
  }
  /** Cancelled or blocked exchanges are reported as missing. */
  async get(id: string, accountId: string): Promise<RemoteExchange> {
    const row = await this.db
      .prepare(`${viewQuery} AND exchange.id = ?2 AND ${visibleToViewer}`)
      .bind(accountId, id)
      .first<ExchangeViewRow>();
    if (!row)
      throw new ApiError(404, "EXCHANGE_NOT_FOUND", "交換が見つかりません");
    return this.toView(row);
  }
  /** One sync page: offset paging for older clients, or a keyset position. */
  async listPage(
    accountId: string,
    offset: number,
    after: ExchangePosition | null = null,
  ): Promise<RemoteExchange[]> {
    const rows = await this.db
      .prepare(
        `${viewQuery} AND ${visibleToViewer}
        AND (?2 IS NULL OR (exchange.created_at, exchange.id) < (?2, ?3))
        ${newestFirst} LIMIT 101 OFFSET ?4`,
      )
      .bind(accountId, after?.at ?? null, after?.id ?? null, offset)
      .all<ExchangeViewRow>();
    return rows.results.map((row) => this.toView(row));
  }
  async list(accountId: string): Promise<RemoteExchange[]> {
    const rows = await this.db
      .prepare(`${viewQuery} AND ${visibleToViewer} ${newestFirst} LIMIT 200`)
      .bind(accountId)
      .all<ExchangeViewRow>();
    return rows.results.map((row) => this.toView(row));
  }
  /**
   * Cancels an active exchange. The returned view is read before the write, so
   * the canceller receives the profile it could already see, and never again.
   */
  async cancel(id: string, accountId: string): Promise<RemoteExchange> {
    const exchange = await this.requireParticipant(id, accountId);
    if (exchange.status === "cancelled")
      throw new ApiError(
        409,
        "EXCHANGE_CANCELLED",
        "この交換はすでに解除されています",
      );
    const view = await this.get(id, accountId).catch((error: unknown) => {
      // Blocked relationships stay hidden; unblocking shows the exchange again.
      if (error instanceof ApiError && error.status === 404)
        throw new ApiError(
          403,
          "EXCHANGE_BLOCKED",
          "このプレイヤーとは交換できません",
        );
      throw error;
    });
    const result = await this.db
      .prepare(
        `UPDATE exchanges SET status = 'cancelled' WHERE id = ?1 AND status != 'cancelled'
        AND (player_a = ?2 OR player_b = ?2) AND ${noBlockBetween("player_a", "player_b")}`,
      )
      .bind(id, accountId)
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        "EXCHANGE_CONFLICT",
        "交換の状態が更新されました。もう一度確認してください",
      );
    return {
      ...view,
      status: "cancelled",
      peer: { ...view.peer, profile: { ...view.peer.profile, snsLinks: [] } },
    };
  }
}
