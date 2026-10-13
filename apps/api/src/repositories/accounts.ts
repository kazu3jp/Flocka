import {
  profileSchema,
  remotePlayerSchema,
  type Profile,
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
};
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
  toPlayer(row: AccountRow): RemotePlayer {
    return remotePlayerSchema.parse({
      id: row.id,
      profile: profileSchema.parse(JSON.parse(row.profile_json)),
      self: JSON.parse(row.self_json),
      avatarAvailable: row.avatar_key !== null,
      avatarVersion: row.avatar_key,
    });
  }
  async getPlayer(id: string): Promise<RemotePlayer> {
    return this.toPlayer(await this.find(id));
  }
  async updateProfile(
    id: string,
    profile: Profile,
    self: string[],
  ): Promise<RemotePlayer> {
    const { photo: _photo, ...avatar } = profile.avatar;
    await this.db
      .prepare(
        "UPDATE accounts SET profile_json = ?, self_json = ?, avatar_key = CASE WHEN ? = 'photo' THEN avatar_key ELSE NULL END WHERE id = ?",
      )
      .bind(
        JSON.stringify({ ...profile, avatar }),
        JSON.stringify(self),
        avatar.type,
        id,
      )
      .run();
    return this.getPlayer(id);
  }
}
