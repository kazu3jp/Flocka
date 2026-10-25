import { Linking } from "react-native";
import { snsLinkUrl, type SnsLink } from "@flocka/domain";

/**
 * Opens a self-declared SNS link. The URL is rebuilt from the validated handle,
 * so a stale or tampered value is refused instead of being handed to the OS.
 * Failures are thrown: the caller must tell the user, never report success.
 */
export async function openSnsLink(link: SnsLink): Promise<void> {
  const url = snsLinkUrl(link);
  if (!url) throw new Error("このSNSリンクは開けません");
  try {
    await Linking.openURL(url);
  } catch {
    throw new Error("リンクを開けませんでした");
  }
}
