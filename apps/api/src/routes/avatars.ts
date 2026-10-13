import { Hono } from "hono";
import { ApiError, readBody, type ApiContext } from "../http";
import { AccountsRepository } from "../repositories/accounts";

export const avatarRoutes = new Hono<ApiContext>();
avatarRoutes.put("/me/avatar", async (c) => {
  const mime = c.req.header("Content-Type")?.split(";")[0];
  if (mime !== "image/jpeg" && mime !== "image/png")
    throw new ApiError(
      415,
      "IMAGE_REQUIRED",
      "JPEGまたはPNGを送信してください",
    );
  const bytes = await readBody(c.req.raw, 1024 * 1024);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if ((mime === "image/jpeg" && !jpeg) || (mime === "image/png" && !png))
    throw new ApiError(
      422,
      "INVALID_IMAGE",
      "画像データの形式を確認できません",
    );
  const key = `avatars/${c.get("accountId")}/${crypto.randomUUID()}`;
  await c.env.AVATARS.put(key, bytes, { httpMetadata: { contentType: mime } });
  await c.env.DB.prepare("UPDATE accounts SET avatar_key = ? WHERE id = ?")
    .bind(key, c.get("accountId"))
    .run();
  return c.json({ avatarAvailable: true, avatarKey: key });
});
avatarRoutes.get("/me/avatar", async (c) => {
  const account = await new AccountsRepository(c.env.DB).find(
    c.get("accountId"),
  );
  if (!account.avatar_key)
    throw new ApiError(404, "AVATAR_NOT_FOUND", "写真は保存されていません");
  const object = await c.env.AVATARS.get(account.avatar_key);
  if (!object)
    throw new ApiError(404, "AVATAR_NOT_FOUND", "写真が見つかりません");
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
});
avatarRoutes.get("/me/backup/avatar", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT avatar_key FROM backups WHERE account_id = ?",
  )
    .bind(c.get("accountId"))
    .first<{ avatar_key: string | null }>();
  if (!row?.avatar_key)
    throw new ApiError(
      404,
      "AVATAR_NOT_FOUND",
      "バックアップに写真はありません",
    );
  const object = await c.env.AVATARS.get(row.avatar_key);
  if (!object)
    throw new ApiError(
      404,
      "AVATAR_NOT_FOUND",
      "バックアップの写真が見つかりません",
    );
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
});
