import { z } from "zod";
import { API_URL } from "./client";

const authConfigSchema = z.object({
  providers: z.array(z.literal("google")),
});

/** Sign-in providers the auth API offers besides email, such as Google. */
export async function fetchAuthProviders(signal: AbortSignal) {
  const response = await fetch(API_URL + "/auth/config", { signal });
  if (!response.ok) throw new Error("認証設定を読み込めませんでした");
  return authConfigSchema.parse(await response.json()).providers;
}
