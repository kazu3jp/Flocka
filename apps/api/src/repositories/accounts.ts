import {
  profileSchema,
  snsLinksSchema,
  remotePlayerSchema,
  type ProfileInput,
  type RemotePlayer,
} from "@flocka/domain";
import { ApiError } from "../http";

export type AccountRow = {
  id: string;
  profile_json: string;
  self_json: string;
  settings_json: string;
  avatar_key: string | null;
  created_at: string;
  sns_links_json: string;
};
/** `connected` is computed in SQL: accepted exchange with the viewer and no block either way. */
type VisibleAccountRow = AccountRow & { connected: number };
export class AccountsRepository {
  constructor(private readonly db: D1Database) {}
  async find(id: string): Promise<AccountRow> {
    const row = await this.db
      .prepare("SELECT * FROM accounts WHERE id = ?")
      .bind(id)
      .first<AccountRow>();
    if (!row)
      throw new ApiError(404, "PLAYER_NOT_FOUND", "プレイヤーが見つかりません");
    return row;
  }
  /**
   * `shareSnsLinks` is required so every caller decides: the owner and accepted
   * exchange partners get the self-declared links, everyone else gets none.
   */
  toPlayer(row: AccountRow, shareSnsLinks: boolean): RemotePlayer {
    return remotePlayerSchema.parse({
      id: row.id,
      profile: {
        ...profileSchema.parse(JSON.parse(row.profile_json)),
        snsLinks: shareSnsLinks
          ? snsLinksSchema.parse(JSON.parse(row.sns_links_json))
          : [],
      },
      self: JSON.parse(row.self_json),
      avatarAvailable: row.avatar_key !== null,
      avatarVersion: row.avatar_key,
    });
  }
  /**
   * Profiles for one sync page in a single query. A player who blocked the
   * viewer is left out; the viewer's own block list still names its players.
   */
  async listVisiblePlayers(
    ids: string[],
    viewerId: string,
  ): Promise<RemotePlayer[]> {
    if (!ids.length) return [];
    const rows = await this.db
      .prepare(
        `SELECT account.*, EXISTS(SELECT 1 FROM exchanges AS exchange WHERE exchange.status = 'accepted'
          AND ((exchange.player_a = account.id AND exchange.player_b = ?2) OR (exchange.player_a = ?2 AND exchange.player_b = account.id))
          AND NOT EXISTS(SELECT 1 FROM blocks WHERE (account_id = account.id AND blocked_id = ?2) OR (account_id = ?2 AND blocked_id = account.id))) AS connected
        FROM accounts AS account WHERE id IN (SELECT value FROM json_each(?1))
        AND NOT EXISTS(SELECT 1 FROM blocks WHERE account_id = account.id AND blocked_id = ?2)`,
      )
      .bind(JSON.stringify(ids), viewerId)
      .all<VisibleAccountRow>();
    return rows.results.map((row) => this.toPlayer(row, row.connected === 1));
  }
  /** The account's own view of itself, including its SNS links. */
  async getOwnPlayer(id: string): Promise<RemotePlayer> {
    return this.toPlayer(await this.find(id), true);
  }
  /** A stranger's view (invite preview): the profile without SNS links. */
  async getPlayerWithoutSnsLinks(id: string): Promise<RemotePlayer> {
    return this.toPlayer(await this.find(id), false);
  }
  async updateProfile(
    id: string,
    profile: ProfileInput,
    self: string[],
  ): Promise<RemotePlayer> {
    const { photo: _photo, ...avatar } = profile.avatar;
    const { snsLinks, ...shared } = profile;
    await this.db
      .prepare(
        "UPDATE accounts SET profile_json = ?, self_json = ?, sns_links_json = COALESCE(?, sns_links_json), avatar_key = CASE WHEN ? = 'photo' THEN avatar_key ELSE NULL END WHERE id = ?",
      )
      .bind(
        JSON.stringify({ ...shared, avatar }),
        JSON.stringify(self),
        snsLinks === undefined ? null : JSON.stringify(snsLinks),
        avatar.type,
        id,
      )
      .run();
    return this.getOwnPlayer(id);
  }
}
