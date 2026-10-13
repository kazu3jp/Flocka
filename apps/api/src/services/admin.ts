export function isAdmin(env: Env, accountId: string): boolean {
  return (env.ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .includes(accountId);
}
