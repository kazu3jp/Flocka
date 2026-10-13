import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth/config";
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
  const session = await createAuth(c.env, c.executionCtx).api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session)
    throw new ApiError(401, "UNAUTHORIZED", "ログイン情報が必要です");
  if (!session.user.emailVerified)
    throw new ApiError(
      403,
      "EMAIL_NOT_VERIFIED",
      "メールアドレスを確認してください",
    );
  c.set("accountId", session.user.id);
  await next();
});
