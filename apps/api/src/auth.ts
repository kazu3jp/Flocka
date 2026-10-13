import { createMiddleware } from "hono/factory";
import { ApiError, type ApiContext } from "./http";

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export async function hashToken(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export const requireSession = createMiddleware<ApiContext>(async (c, next) => {
  const header = c.req.header("Authorization"),
    match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header || "");
  if (!match) throw new ApiError(401, "UNAUTHORIZED", "ログイン情報が必要です");
  const row = await c.env.DB.prepare(
    "SELECT account_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
  )
    .bind(await hashToken(match[1]), new Date().toISOString())
    .first<{ account_id: string }>();
  if (!row)
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "ログイン情報を確認できませんでした",
    );
  c.set("accountId", row.account_id);
  await next();
});
