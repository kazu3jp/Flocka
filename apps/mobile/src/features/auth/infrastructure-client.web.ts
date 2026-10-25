import { dashClient, sentinelClient } from "@better-auth/infra/client";
import { INFRASTRUCTURE_CLIENT_ENABLED } from "./infrastructure-enabled";

export function infrastructureClientPlugins() {
  if (!INFRASTRUCTURE_CLIENT_ENABLED) return [];
  return [dashClient(), sentinelClient()] as const;
}
