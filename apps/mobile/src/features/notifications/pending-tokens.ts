/** Read the stored list of push tokens awaiting removal; unreadable data is empty. */
export function parsePendingTokens(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (token): token is string =>
                typeof token === "string" && token.length > 0,
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
