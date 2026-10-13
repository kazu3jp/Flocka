import { applicationRoutes } from "./routes/application";
import { rateLimit } from "./middleware/rate-limit";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { createAuth, socialProviders } from "./auth/config";
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
  const appleCallback =
    c.req.path === "/api/auth/callback/apple" &&
    origin === "https://appleid.apple.com" &&
    socialProviders(c.env).apple;
  if (
    origin &&
    !allowed.includes(origin) &&
    !origin.startsWith("flocka://") &&
    !appleCallback
  )
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
    credentials: true,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "expo-origin",
      "x-skip-oauth-proxy",
    ],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);
app.get("/health", async (c) => {
  await c.env.DB.prepare("SELECT 1").first();
  return c.json({ status: "ok", service: "flocka-api" });
});
app.get("/auth/config", (c) =>
  c.json({ providers: Object.keys(socialProviders(c.env)) }),
);
app.use("/api/auth/*", bodyLimit({ maxSize: 16 * 1024 }));
app.on(["GET", "POST"], "/api/auth/*", (c) =>
  createAuth(c.env, c.executionCtx).handler(c.req.raw),
);
app.use("/v1/*", requireSession);
app.use("/v1/*", rateLimit);
app.route("/v1", accountRoutes);
app.route("/v1", applicationRoutes);
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
