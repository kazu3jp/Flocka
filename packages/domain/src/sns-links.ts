import { z } from "zod";

/**
 * SNS links are self-declared handles. Flocka never verifies ownership, and a
 * link is never stored as a free-form URL: only a per-platform handle is kept,
 * and the URL is rebuilt from a fixed https template. This is what keeps
 * javascript:, data: and look-alike hosts out of the profile card.
 */
export const SNS_PLATFORMS = [
  "x",
  "instagram",
  "tiktok",
  "youtube",
  "github",
  "line",
] as const;
export type SnsPlatform = (typeof SNS_PLATFORMS)[number];

export const SNS_PLATFORM_LABELS: Record<SnsPlatform, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  github: "GitHub",
  line: "LINE",
};

/** What the profile editor asks for, per platform. */
export const SNS_INPUT_HINTS: Record<SnsPlatform, string> = {
  x: "@ユーザー名 またはプロフィールURL",
  instagram: "@ユーザー名 またはプロフィールURL",
  tiktok: "@ユーザー名 またはプロフィールURL",
  youtube: "@ハンドル またはチャンネルURL",
  github: "ユーザー名 またはプロフィールURL",
  line: "LINE ID またはLINEのプロフィールURL",
};

export type SnsLink = { platform: SnsPlatform; value: string };

export const SNS_INPUT_MAX_LENGTH = 200;

const HANDLE_PATTERNS: Record<SnsPlatform, RegExp> = {
  x: /^[A-Za-z0-9_]{1,15}$/,
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  tiktok: /^[A-Za-z0-9._]{2,24}$/,
  youtube: /^[A-Za-z0-9._-]{3,30}$/,
  github: /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/,
  line: /^[A-Za-z0-9._-]{4,20}$/,
};

/** Site paths that look like a handle but are not a profile. */
const RESERVED_PATHS: Partial<Record<SnsPlatform, ReadonlySet<string>>> = {
  x: new Set(["home", "i", "intent", "share", "search", "explore", "settings"]),
  instagram: new Set(["p", "reel", "reels", "explore", "accounts", "stories"]),
  github: new Set([
    "orgs",
    "settings",
    "login",
    "pricing",
    "features",
    "sponsors",
    "marketplace",
    "topics",
  ]),
};

const PROFILE_HOSTS: Record<SnsPlatform, readonly string[]> = {
  x: ["x.com", "twitter.com"],
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com"],
  github: ["github.com"],
  line: ["line.me"],
};

const URL_TEMPLATES: Record<SnsPlatform, (handle: string) => string> = {
  x: (handle) => `https://x.com/${handle}`,
  instagram: (handle) => `https://www.instagram.com/${handle}`,
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
  youtube: (handle) => `https://www.youtube.com/@${handle}`,
  github: (handle) => `https://github.com/${handle}`,
  line: (handle) => `https://line.me/ti/p/~${handle}`,
};

/** Prefix the platform puts before the handle inside its profile URL. */
const URL_HANDLE_PREFIX: Record<SnsPlatform, string> = {
  x: "",
  instagram: "",
  tiktok: "@",
  youtube: "@",
  github: "",
  line: "~",
};

/** The handle inside a profile URL of this platform, or null for any other URL. */
function handleFromProfileUrl(
  platform: SnsPlatform,
  input: string,
): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  if (!PROFILE_HOSTS[platform].includes(host)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const prefix = URL_HANDLE_PREFIX[platform];
  let candidate: string | undefined;
  if (platform === "line") {
    const path = segments[0] === "R" ? segments.slice(1) : segments;
    if (path.length !== 3 || path[0] !== "ti" || path[1] !== "p") return null;
    candidate = path[2];
  } else {
    if (segments.length !== 1) return null;
    candidate = segments[0];
  }
  if (prefix && !candidate.startsWith(prefix)) return null;
  const handle = prefix ? candidate.slice(prefix.length) : candidate;
  if (RESERVED_PATHS[platform]?.has(handle.toLowerCase())) return null;
  return handle;
}

/**
 * Accepts a bare handle, "@handle", or the platform's own profile URL and
 * returns the canonical handle. Anything else (other schemes, other hosts,
 * paths that are not a profile, over-long input) returns null.
 */
export function normalizeSnsHandle(
  platform: SnsPlatform,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > SNS_INPUT_MAX_LENGTH) return null;
  let handle: string | null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed))
    handle = handleFromProfileUrl(platform, trimmed);
  else if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(trimmed))
    handle = handleFromProfileUrl(platform, `https://${trimmed}`);
  else {
    const prefix = platform === "line" ? "~" : "@";
    handle = trimmed.startsWith(prefix) ? trimmed.slice(1) : trimmed;
    if (RESERVED_PATHS[platform]?.has(handle.toLowerCase())) handle = null;
  }
  return handle !== null && HANDLE_PATTERNS[platform].test(handle)
    ? handle
    : null;
}

/**
 * The https URL to open for a stored link, or null when the stored value does
 * not pass validation (for example a stale cache). Callers open only this value.
 */
export function snsLinkUrl(link: SnsLink): string | null {
  if (!Object.hasOwn(URL_TEMPLATES, link.platform)) return null;
  const handle = normalizeSnsHandle(link.platform, link.value);
  return handle === link.value ? URL_TEMPLATES[link.platform](handle) : null;
}

/** Text shown on the card: the handle as the platform writes it. */
export function snsLinkDisplay(link: SnsLink): string {
  return link.platform === "github" || link.platform === "line"
    ? link.value
    : `@${link.value}`;
}

export const snsLinkSchema = z
  .object({
    platform: z.enum(SNS_PLATFORMS),
    value: z.string().min(1).max(SNS_INPUT_MAX_LENGTH),
  })
  .strict()
  .refine(
    (link) => normalizeSnsHandle(link.platform, link.value) === link.value,
    "SNSのユーザー名の形式が正しくありません",
  );

/** At most one link per platform. */
export const snsLinksSchema = z
  .array(snsLinkSchema)
  .max(SNS_PLATFORMS.length)
  .refine(
    (links) =>
      new Set(links.map((link) => link.platform)).size === links.length,
    "同じSNSを複数登録できません",
  );
