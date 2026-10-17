import { Hono } from "hono";
import { pushDeviceSchema } from "@flocka/domain";
import { ApiError, readJson, type ApiContext } from "../http";

export const deviceRoutes = new Hono<ApiContext>();
deviceRoutes.put("/me/push-devices", async (c) => {
  const { token, platform } = await readJson(c, pushDeviceSchema);
  const registered = await c.env.DB.prepare(
    `INSERT INTO push_devices(token, account_id, platform, updated_at) SELECT ?1, ?2, ?3, ?4 WHERE EXISTS(SELECT 1 FROM accounts WHERE id = ?2) AND NOT EXISTS(SELECT 1 FROM account_deletions WHERE account_id = ?2)
    ON CONFLICT(token) DO UPDATE SET account_id = excluded.account_id, platform = excluded.platform, updated_at = excluded.updated_at RETURNING token`,
  )
    .bind(token, c.get("accountId"), platform, new Date().toISOString())
    .first();
  if (!registered)
    throw new ApiError(
      409,
      "ACCOUNT_UNAVAILABLE",
      "アカウントが削除中、または利用できません",
    );
  return c.json({ registered: true });
});
deviceRoutes.delete("/me/push-devices", async (c) => {
  const { token } = await readJson(c, pushDeviceSchema.pick({ token: true }));
  await c.env.DB.prepare(
    "DELETE FROM push_devices WHERE token = ? AND account_id = ?",
  )
    .bind(token, c.get("accountId"))
    .run();
  return c.json({ registered: false });
});
