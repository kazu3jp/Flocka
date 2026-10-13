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
};
const viewQuery = `
  SELECT exchange.*, mine.approved_at AS my_approved, theirs.approved_at AS peer_approved,
    mine.place, mine.trigger, peer.id AS peer_id, peer.profile_json, peer.self_json,
    peer.settings_json, peer.avatar_key, peer.created_at AS peer_created_at
  FROM exchanges AS exchange
  JOIN exchange_participants AS mine ON mine.exchange_id = exchange.id AND mine.account_id = ?
  JOIN exchange_participants AS theirs ON theirs.exchange_id = exchange.id AND theirs.account_id != mine.account_id
  JOIN accounts AS peer ON peer.id = theirs.account_id
`;
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
  private toView(row: ExchangeViewRow): RemoteExchange {
    const peer: AccountRow = {
      id: row.peer_id,
      profile_json: row.profile_json,
      self_json: row.self_json,
      settings_json: row.settings_json,
      avatar_key: row.avatar_key,
      created_at: row.peer_created_at,
    };
    return {
      id: row.id,
      status: row.status,
      myApproved: row.my_approved !== null,
      peerApproved: row.peer_approved !== null,
      context: { place: row.place, trigger: row.trigger },
      peer: new AccountsRepository(this.db).toPlayer(peer),
      createdAt: row.created_at,
    };
  }
  async get(id: string, accountId: string): Promise<RemoteExchange> {
    const row = await this.db
      .prepare(viewQuery + " WHERE exchange.id = ?")
      .bind(accountId, id)
      .first<ExchangeViewRow>();
    if (!row)
      throw new ApiError(404, "EXCHANGE_NOT_FOUND", "交換が見つかりません");
    return this.toView(row);
  }
  async list(accountId: string): Promise<RemoteExchange[]> {
    const rows = await this.db
      .prepare(
        viewQuery +
          ` WHERE exchange.status != 'cancelled'
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE account_id = mine.account_id AND blocked_id = theirs.account_id)
      ORDER BY exchange.created_at DESC, exchange.id DESC LIMIT 200`,
      )
      .bind(accountId)
      .all<ExchangeViewRow>();
    return rows.results.map((row) => this.toView(row));
  }
}
