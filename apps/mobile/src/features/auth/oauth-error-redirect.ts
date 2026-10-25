import { Linking } from "react-native";
import { oauthErrorFromUrl } from "./oauth-error-url";

/**
 * Better Auth sends a failed browser sign-in back to the app as
 * `flocka://auth?error=<code>`. The auth client swallows that URL, so the app
 * listens for it while the browser sign-in runs. Successful redirects carry a
 * session cookie in the URL; only the `error` value is ever read from it.
 */
export function watchOAuthErrorRedirect() {
  let code: string | null = null;
  const subscription = Linking.addEventListener("url", ({ url }) => {
    code = oauthErrorFromUrl(url) ?? code;
  });
  return {
    error: () => code,
    stop: () => subscription.remove(),
  };
}
