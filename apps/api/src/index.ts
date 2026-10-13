import { Hono } from "hono";
import { cors } from "hono/cors";
import { requireSession } from "./auth";
import { ApiError, type ApiContext } from "./http";
import { accountRoutes } from "./routes/accounts";
import { avatarRoutes } from "./routes/avatars";
import { exchangeRoutes } from "./routes/exchanges";
import { testimonyRoutes } from "./routes/testimonies";

const app = new Hono<ApiContext>();
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header("X-Request-ID", c.get("requestId"));
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "no-store");
});
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin"),
    allowed = c.env.ALLOWED_ORIGINS.split(",");
  if (origin && !allowed.includes(origin))
    throw new ApiError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "このオリジンからはアクセスできません",
    );
  await next();
});
app.use(
  "*",
  cors({
    origin: (origin, c) =>
      c.env.ALLOWED_ORIGINS.split(",").includes(origin) ? origin : undefined,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);
app.get("/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ status: "ok", service: "flocka-api" });
});
app.use("/v1/*", async (c, next) => {
  if (c.req.path === "/v1/accounts" && c.req.method === "POST") {
    await next();
    return;
  }
  await requireSession(c, next);
});
app.route("/v1", accountRoutes);
app.route("/v1", avatarRoutes);
app.route("/v1", exchangeRoutes);
app.route("/v1", testimonyRoutes);
app.notFound((c) =>
  c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "APIが見つかりません",
        requestId: c.get("requestId"),
      },
    },
    404,
  ),
);
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId: c.get("requestId"),
        },
      },
      error.status,
    );
  console.error(
    JSON.stringify({
      event: "api.error",
      requestId: c.get("requestId"),
      name: error.name,
    }),
  );
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "処理に失敗しました",
        requestId: c.get("requestId"),
      },
    },
    500,
  );
});
export default app;
