import { Hono } from "hono";
import {
  backupRecordSchema,
  backupRequestSchema,
  createAccountSchema,
  settingsSchema,
} from "@flocka/domain";
import { ApiError, readJson, type ApiContext } from "../http";
import { AccountsRepository } from "../repositories/accounts";

export const accountRoutes = new Hono<ApiContext>();
accountRoutes.post("/accounts", async (c) => {
  const input = await readJson(c, createAccountSchema),
    id = c.get("accountId"),
    at = new Date().toISOString();
  const { photo: _photo, ...avatar } = input.profile.avatar;
  await c.env.DB.prepare(
    "INSERT INTO accounts(id, profile_json, self_json, created_at) VALUES(?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
  )
    .bind(
      id,
      JSON.stringify({ ...input.profile, avatar }),
      JSON.stringify(input.self),
      at,
    )
    .run();
  return c.json(await new AccountsRepository(c.env.DB).getPlayer(id), 201);
});
accountRoutes.get("/me", async (c) =>
  c.json(await new AccountsRepository(c.env.DB).getPlayer(c.get("accountId"))),
);
accountRoutes.patch("/me", async (c) => {
  const input = await readJson(c, createAccountSchema);
  return c.json(
    await new AccountsRepository(c.env.DB).updateProfile(
      c.get("accountId"),
      input.profile,
      input.self,
    ),
  );
});
accountRoutes.put("/me/settings", async (c) => {
  const settings = await readJson(c, settingsSchema);
  await c.env.DB.prepare("UPDATE accounts SET settings_json = ? WHERE id = ?")
    .bind(JSON.stringify(settings), c.get("accountId"))
    .run();
  return c.json(settings);
});
accountRoutes.get("/me/backup", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT snapshot_json, revision, updated_at FROM backups WHERE account_id = ?",
  )
    .bind(c.get("accountId"))
    .first<{ snapshot_json: string; revision: number; updated_at: string }>();
  if (!row)
    throw new ApiError(
      404,
      "BACKUP_NOT_FOUND",
      "保存されたバックアップはありません",
    );
  return c.json(
    backupRecordSchema.parse({
      snapshot: JSON.parse(row.snapshot_json),
      revision: row.revision,
      updatedAt: row.updated_at,
    }),
  );
});
accountRoutes.put("/me/backup", async (c) => {
  const {
      snapshot,
      revision,
      avatarKey: requestedAvatarKey,
    } = await readJson(c, backupRequestSchema, 1024 * 1024),
    at = new Date().toISOString(),
    accountId = c.get("accountId");
  const avatarKey =
    snapshot.profile.avatar.type === "photo" ? requestedAvatarKey : null;
  if (
    snapshot.profile.avatar.type === "photo" &&
    (!avatarKey ||
      !avatarKey.startsWith(`avatars/${accountId}/`) ||
      !(await c.env.AVATARS.head(avatarKey)))
  )
    throw new ApiError(
      422,
      "AVATAR_REQUIRED",
      "本人の写真をR2へ保存してからバックアップしてください",
    );
  // Photo bytes belong to R2. Private snapshots hold only the avatar settings.
  delete snapshot.profile.avatar.photo;
  const statement =
    revision === null
      ? c.env.DB.prepare(
          "INSERT INTO backups(account_id, snapshot_json, revision, updated_at, avatar_key) VALUES(?, ?, 1, ?, ?) ON CONFLICT(account_id) DO NOTHING RETURNING revision",
        ).bind(accountId, JSON.stringify(snapshot), at, avatarKey || null)
      : c.env.DB.prepare(
          "UPDATE backups SET snapshot_json = ?, revision = revision + 1, updated_at = ?, avatar_key = ? WHERE account_id = ? AND revision = ? RETURNING revision",
        ).bind(
          JSON.stringify(snapshot),
          at,
          avatarKey || null,
          accountId,
          revision,
        );
  const result = await statement.first<{ revision: number }>();
  if (!result)
    throw new ApiError(
      409,
      "BACKUP_CONFLICT",
      "バックアップが更新されています。最新の内容を確認してください",
    );
  return c.json({ revision: result.revision, snapshot, updatedAt: at });
});
