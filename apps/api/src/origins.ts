/** Comma-separated origins from configuration, trimmed, without empty entries. */
export function allowedOrigins(env: Pick<Env, "ALLOWED_ORIGINS">): string[] {
  return env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
