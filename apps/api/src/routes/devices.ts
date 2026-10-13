import { Hono } from "hono";
import { pushDeviceSchema } from "@flocka/domain";
import { readJson, type ApiContext } from "../http";

export const deviceRoutes = new Hono<ApiContext>();
deviceRoutes.put("/me/push-devices", async (c) => {
  const { token, platform } = await readJson(c, pushDeviceSchema);
  await c.env.DB.prepare(
    `INSERT INTO push_devices(token, account_id, platform, updated_at) VALUES(?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET account_id = excluded.account_id, platform = excluded.platform, updated_at = excluded.updated_at`,
  )
    .bind(token, c.get("accountId"), platform, new Date().toISOString())
    .run();
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
