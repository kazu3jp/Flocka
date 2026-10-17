import { z } from "zod";
import { readBody } from "../http";
import { symmetricDecrypt } from "better-auth/crypto";

/** Reads both legacy plaintext tokens and Better Auth's encrypted envelopes. */
async function readToken(value: string, secret: string): Promise<string> {
  if (
    value.startsWith("$ba$") ||
    (value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value))
  )
    return symmetricDecrypt({ key: secret, data: value });
  return value;
}

/** Clear each token only after its provider confirms revocation, so retries are safe. */
export async function revokeProviderTokens(
  env: Env,
  accountId: string,
): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT id, provider_id, access_token, refresh_token, revocation_completed_at FROM auth_accounts WHERE user_id = ? AND provider_id != 'credential'",
  )
    .bind(accountId)
    .all<{
      id: string;
      provider_id: string;
      access_token: string | null;
      refresh_token: string | null;
      revocation_completed_at: string | null;
    }>();
  for (const account of results) {
    const stored = account.refresh_token || account.access_token;
    if (account.revocation_completed_at) continue;
    if (!stored) throw new Error("PROVIDER_REVOCATION_TOKEN_MISSING");
    const token = await readToken(stored, env.BETTER_AUTH_SECRET);
    const body = new URLSearchParams({ token });
    let url: string;
    if (account.provider_id === "apple") {
      if (!env.APPLE_CLIENT_ID || !env.APPLE_CLIENT_SECRET)
        throw new Error("APPLE_REVOCATION_NOT_CONFIGURED");
      url = "https://appleid.apple.com/auth/revoke";
      body.set("client_id", env.APPLE_CLIENT_ID);
      body.set("client_secret", env.APPLE_CLIENT_SECRET);
      body.set(
        "token_type_hint",
        account.refresh_token ? "refresh_token" : "access_token",
      );
    } else if (account.provider_id === "google") {
      url = "https://oauth2.googleapis.com/revoke";
    } else {
      throw new Error("UNSUPPORTED_PROVIDER_REVOCATION");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    // Fail closed. Provider error bodies may contain tokens and must not be logged.
    let revoked = response.ok;
    if (account.provider_id === "google" && response.status === 400) {
      const body = await readBody(response, 4096);
      revoked = z
        .object({ error: z.literal("invalid_token") })
        .safeParse(JSON.parse(new TextDecoder().decode(body))).success;
    } else await response.body?.cancel();
    if (!revoked) throw new Error("PROVIDER_REVOCATION_FAILED");
    await env.DB.prepare(
      "UPDATE auth_accounts SET access_token = NULL, refresh_token = NULL, id_token = NULL, revocation_completed_at = ? WHERE id = ? AND user_id = ?",
    )
      .bind(new Date().toISOString(), account.id, accountId)
      .run();
  }
}

/** Ask for a new provider login before accepting an intent that cannot be fulfilled. */
export async function hasMissingProviderToken(
  db: D1Database,
  userId: string,
): Promise<boolean> {
  return Boolean(
    await db
      .prepare(
        "SELECT 1 FROM auth_accounts WHERE user_id = ? AND provider_id != 'credential' AND access_token IS NULL AND refresh_token IS NULL AND revocation_completed_at IS NULL LIMIT 1",
      )
      .bind(userId)
      .first(),
  );
}
