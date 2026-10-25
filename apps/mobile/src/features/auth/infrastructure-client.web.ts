import { dashClient, sentinelClient } from "@better-auth/infra/client";

export function infrastructureClientPlugins() {
  return [dashClient(), sentinelClient()] as const;
}
