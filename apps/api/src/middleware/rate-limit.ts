import { createMiddleware } from "hono/factory";
import { ApiError, type ApiContext } from "../http";
export const rateLimit = createMiddleware<ApiContext>(async (c, next) => {
  const window = Math.floor(Date.now() / 60_000),
    writing =
      !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
      !["/v1/invites/preview", "/v1/invites/status"].includes(c.req.path),
    key = `${c.get("accountId")}:${writing ? "write" : "read"}`,
    max = writing ? 60 : 120;
  const row = await c.env.DB.prepare(
    `INSERT INTO api_request_limits(key, window, count) VALUES(?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window = excluded.window THEN count + 1 ELSE 1 END, window = excluded.window RETURNING count`,
  )
    .bind(key, window)
    .first<{ count: number }>();
  if (!row || row.count > max) {
    c.header("Retry-After", String(60 - (Math.floor(Date.now() / 1000) % 60)));
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "操作が多すぎます。少し待って再試行してください",
    );
  }
  await next();
});
