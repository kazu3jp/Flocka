/** The `error` code of a Better Auth error redirect URL, or null for anything else. */
export function oauthErrorFromUrl(url: string) {
  try {
    const value = new URL(url).searchParams.get("error");
    return value && /^[a-z0-9_]{1,64}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}
