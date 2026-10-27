import {
  SNS_PLATFORMS,
  SNS_PLATFORM_LABELS,
  normalizeSnsHandle,
  snsLinkDisplay,
  snsPlatformOfProfileUrl,
  type SnsLink,
  type SnsPlatform,
} from "@flocka/domain";

/** The text in each service's field of the SNS editor. */
export type SnsInputs = Record<SnsPlatform, string>;

export function snsInputsFromLinks(links: SnsLink[]): SnsInputs {
  const inputs = Object.fromEntries(
    SNS_PLATFORMS.map((platform) => [platform, ""]),
  ) as SnsInputs;
  for (const link of links) inputs[link.platform] = snsLinkDisplay(link);
  return inputs;
}

/**
 * Every filled field becomes a link, in the services' fixed order. A field
 * whose text is not that service's handle or profile URL is reported instead
 * of being dropped, so the caller can hold back saving until it is fixed.
 */
export function readSnsInputs(inputs: SnsInputs): {
  links: SnsLink[];
  errors: Partial<Record<SnsPlatform, string>>;
} {
  const links: SnsLink[] = [];
  const errors: Partial<Record<SnsPlatform, string>> = {};
  for (const platform of SNS_PLATFORMS) {
    const text = inputs[platform].trim();
    if (!text) continue;
    const value = normalizeSnsHandle(platform, text);
    if (value !== null) {
      links.push({ platform, value });
      continue;
    }
    const owner = snsPlatformOfProfileUrl(text);
    errors[platform] =
      owner && owner !== platform
        ? `${SNS_PLATFORM_LABELS[owner]}のURLです。${SNS_PLATFORM_LABELS[owner]}の欄に入力してください`
        : platform === "website"
          ? "WebサイトのURL（https://〜）を確認してください"
          : `${SNS_PLATFORM_LABELS[platform]}のユーザー名またはURLを確認してください`;
  }
  return { links, errors };
}
