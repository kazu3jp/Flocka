/**
 * The Better Auth dashboard and Sentinel clients contact a third-party service
 * (device identification), so they only run in builds that opt in. The server
 * needs `BETTER_AUTH_API_KEY` as well; neither side alone enables tracking.
 */
export const INFRASTRUCTURE_CLIENT_ENABLED =
  process.env.EXPO_PUBLIC_BETTER_AUTH_INFRA === "enabled";
