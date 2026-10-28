import {
  SNS_PLATFORMS,
  normalizeSnsHandle,
  snsPlatformOfProfileUrl,
  type SnsLink,
  type SnsPlatform,
} from "@flocka/domain";

/** What the one SNS field holds, read as the person types or pastes. */
export type SnsEntry =
  | { kind: "empty" }
  /** Ready to add: a service's profile URL, a website, or a handle whose service is known. */
  | { kind: "link"; link: SnsLink }
  /** A bare handle more than one service accepts; the person picks the service. */
  | { kind: "choose"; candidates: SnsPlatform[] }
  | { kind: "invalid"; message: string };

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * A profile URL names its service; any other http(s) URL is the person's
 * website. Text without a scheme may be a handle of several services (or a
 * website's address), so it is offered as the services that accept it, unless
 * only one does or the person already picked one of them.
 */
export function readSnsEntry(
  text: string,
  chosen: SnsPlatform | null = null,
): SnsEntry {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "empty" };
  const owner = snsPlatformOfProfileUrl(trimmed);
  if (owner) {
    const value = normalizeSnsHandle(owner, trimmed);
    if (value !== null)
      return { kind: "link", link: { platform: owner, value } };
  }
  if (HAS_SCHEME.test(trimmed)) {
    const value = normalizeSnsHandle("website", trimmed);
    return value === null
      ? {
          kind: "invalid",
          message:
            "このURLは追加できません。https://から始まるURLか確認してください",
        }
      : { kind: "link", link: { platform: "website", value } };
  }
  const candidates = SNS_PLATFORMS.filter(
    (platform) => normalizeSnsHandle(platform, trimmed) !== null,
  );
  if (candidates.length === 0)
    return {
      kind: "invalid",
      message: "SNSのプロフィールURL、またはユーザー名を入力してください",
    };
  const platform =
    candidates.length === 1
      ? candidates[0]
      : chosen && candidates.includes(chosen)
        ? chosen
        : null;
  if (!platform) return { kind: "choose", candidates };
  return {
    kind: "link",
    link: { platform, value: normalizeSnsHandle(platform, trimmed)! },
  };
}

/** Adds the link, replacing that service's earlier one, in the services' order. */
export function withSnsLink(links: SnsLink[], link: SnsLink): SnsLink[] {
  const next = [
    ...links.filter((current) => current.platform !== link.platform),
    link,
  ];
  return SNS_PLATFORMS.flatMap((platform) =>
    next.filter((current) => current.platform === platform),
  );
}

export function withoutSnsLink(
  links: SnsLink[],
  platform: SnsPlatform,
): SnsLink[] {
  return links.filter((link) => link.platform !== platform);
}
