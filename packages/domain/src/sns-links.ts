import { z } from "zod";

/**
 * Links on the profile card are self-declared. Flocka never verifies
 * ownership. A service link is never stored as a free-form URL: only a
 * per-service handle is kept, and the URL is rebuilt from a fixed https
 * template. The person's own website is the one free URL, kept only as a
 * canonical http(s) URL without credentials or a port. This is what keeps
 * javascript:, data: and look-alike hosts out of the profile card.
 */
export const SNS_PLATFORMS = [
  "x",
  "github",
  "zenn",
  "qiita",
  "note",
  "bluesky",
  "website",
] as const;
export type SnsPlatform = (typeof SNS_PLATFORMS)[number];
type SnsService = Exclude<SnsPlatform, "website">;

export const SNS_PLATFORM_LABELS: Record<SnsPlatform, string> = {
  x: "X",
  github: "GitHub",
  zenn: "Zenn",
  qiita: "Qiita",
  note: "note",
  bluesky: "Bluesky",
  website: "Webサイト",
};

/**
 * Placeholder of each field in the profile editor. Short enough for a narrow
 * phone; the note under the fields says a profile URL also works.
 */
export const SNS_INPUT_HINTS: Record<SnsPlatform, string> = {
  x: "@ユーザー名",
  github: "ユーザー名",
  zenn: "@ユーザー名",
  qiita: "@ユーザー名",
  note: "@ノートID",
  bluesky: "@ハンドル",
  website: "https://example.com",
};

export type SnsLink = { platform: SnsPlatform; value: string };

export const SNS_INPUT_MAX_LENGTH = 200;

const BLUESKY_DEFAULT_DOMAIN = ".bsky.social";

const HANDLE_PATTERNS: Record<SnsService, RegExp> = {
  x: /^[A-Za-z0-9_]{1,15}$/,
  github: /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/,
  zenn: /^[A-Za-z0-9_]{1,30}$/,
  qiita: /^[A-Za-z0-9_-]{1,40}$/,
  note: /^[A-Za-z0-9_]{1,30}$/,
  // A domain name: lowercase labels joined by dots.
  bluesky:
    /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
};

/** Site paths that look like a handle but are not a profile. */
const RESERVED_PATHS: Partial<Record<SnsService, ReadonlySet<string>>> = {
  x: new Set(["home", "i", "intent", "share", "search", "explore", "settings"]),
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
  zenn: new Set([
    "articles",
    "books",
    "scraps",
    "topics",
    "search",
    "dashboard",
    "enter",
    "about",
    "events",
  ]),
  qiita: new Set([
    "items",
    "tags",
    "organizations",
    "search",
    "trend",
    "settings",
    "login",
    "signup",
    "advent-calendar",
    "api",
  ]),
  note: new Set([
    "notes",
    "hashtag",
    "search",
    "login",
    "signup",
    "topics",
    "contests",
    "magazines",
    "settings",
  ]),
};

const PROFILE_HOSTS: Record<SnsService, readonly string[]> = {
  x: ["x.com", "twitter.com"],
  github: ["github.com"],
  zenn: ["zenn.dev"],
  qiita: ["qiita.com"],
  note: ["note.com"],
  bluesky: ["bsky.app"],
};

const URL_TEMPLATES: Record<SnsService, (handle: string) => string> = {
  x: (handle) => `https://x.com/${handle}`,
  github: (handle) => `https://github.com/${handle}`,
  zenn: (handle) => `https://zenn.dev/${handle}`,
  qiita: (handle) => `https://qiita.com/${handle}`,
  note: (handle) => `https://note.com/${handle}`,
  bluesky: (handle) => `https://bsky.app/profile/${handle}`,
};

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SCHEMELESS_URL = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\//i;

/** An http(s) URL without credentials or a port; a missing scheme means https. */
function parseWebUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(SCHEME.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  return url;
}

/** The handle inside a profile URL of this service, or null for any other URL. */
function handleFromProfileUrl(
  platform: SnsService,
  input: string,
): string | null {
  const url = parseWebUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  if (!PROFILE_HOSTS[platform].includes(host)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (platform === "bluesky")
    return segments.length === 2 && segments[0] === "profile"
      ? segments[1].toLowerCase()
      : null;
  if (segments.length !== 1) return null;
  const handle = segments[0];
  if (RESERVED_PATHS[platform]?.has(handle.toLowerCase())) return null;
  return handle;
}

function normalizeHandle(platform: SnsService, input: string): string | null {
  let handle: string | null;
  if (SCHEME.test(input) || SCHEMELESS_URL.test(input))
    handle = handleFromProfileUrl(platform, input);
  else {
    handle = input.startsWith("@") ? input.slice(1) : input;
    if (RESERVED_PATHS[platform]?.has(handle.toLowerCase())) handle = null;
    else if (platform === "bluesky") {
      handle = handle.toLowerCase();
      // "alice" is short for the default "alice.bsky.social".
      if (!handle.includes(".")) handle += BLUESKY_DEFAULT_DOMAIN;
    }
  }
  return handle !== null && HANDLE_PATTERNS[platform].test(handle)
    ? handle
    : null;
}

/** A canonical http(s) URL on a dotted host name, or null. */
function normalizeWebsite(input: string): string | null {
  const url = parseWebUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^[\d.]+$/.test(host))
    return null;
  // Profile URLs belong in their service's field.
  if (snsPlatformOfProfileUrl(url.href)) return null;
  return url.href.length <= SNS_INPUT_MAX_LENGTH ? url.href : null;
}

/**
 * Accepts a bare handle, "@handle", or the service's own profile URL and
 * returns the canonical handle; for the website, an http(s) URL, returned
 * canonical. Anything else (other schemes, other hosts, paths that are not a
 * profile, over-long input) returns null.
 */
export function normalizeSnsHandle(
  platform: SnsPlatform,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > SNS_INPUT_MAX_LENGTH) return null;
  if (!Object.hasOwn(SNS_PLATFORM_LABELS, platform)) return null;
  return platform === "website"
    ? normalizeWebsite(trimmed)
    : normalizeHandle(platform, trimmed);
}

/**
 * The service whose profile URL this is, so a URL pasted into another field
 * can point the person to the right one. Null for handles and for URLs that
 * are no service's profile.
 */
export function snsPlatformOfProfileUrl(input: string): SnsService | null {
  const trimmed = input.trim();
  if (!SCHEME.test(trimmed) && !SCHEMELESS_URL.test(trimmed)) return null;
  return (
    SNS_PLATFORMS.filter(
      (platform): platform is SnsService => platform !== "website",
    ).find((platform) => handleFromProfileUrl(platform, trimmed) !== null) ??
    null
  );
}

/**
 * The URL to open for a stored link, or null when the stored value does not
 * pass validation (for example a stale cache). Callers open only this value.
 */
export function snsLinkUrl(link: SnsLink): string | null {
  if (normalizeSnsHandle(link.platform, link.value) !== link.value) return null;
  return link.platform === "website"
    ? link.value
    : URL_TEMPLATES[link.platform](link.value);
}

/** Text shown on the card: the handle as the service writes it, or the site's address. */
export function snsLinkDisplay(link: SnsLink): string {
  if (link.platform === "website") {
    // Without "https://", and reading back to the same URL in the editor.
    const url = parseWebUrl(link.value);
    if (!url) return link.value;
    const address =
      url.hostname +
      (url.pathname === "/" ? "" : url.pathname) +
      url.search +
      url.hash;
    return url.protocol === "http:" ? `http://${address}` : address;
  }
  return link.platform === "github" ? link.value : `@${link.value}`;
}

export const snsLinkSchema = z
  .object({
    platform: z.enum(SNS_PLATFORMS),
    value: z.string().min(1).max(SNS_INPUT_MAX_LENGTH),
  })
  .strict()
  .refine(
    (link) => normalizeSnsHandle(link.platform, link.value) === link.value,
    "SNSのユーザー名またはURLの形式が正しくありません",
  );

/** At most one link per service. */
export const snsLinksSchema = z
  .array(snsLinkSchema)
  .max(SNS_PLATFORMS.length)
  .refine(
    (links) =>
      new Set(links.map((link) => link.platform)).size === links.length,
    "同じSNSを複数登録できません",
  );
