import { dashClient, sentinelNativeClient } from "@better-auth/infra/native";
import * as SecureStore from "expo-secure-store";
import type { BetterAuthClientPlugin } from "better-auth";
import { INFRASTRUCTURE_CLIENT_ENABLED } from "./infrastructure-enabled";

export function infrastructureClientPlugins() {
  if (!INFRASTRUCTURE_CLIENT_ENABLED) return [];
  // The native package declares the full generic plugin type, despite only
  // providing fetch hooks. Keep that broad type out of session schema inference.
  const sentinel: Pick<BetterAuthClientPlugin, "id" | "fetchPlugins"> =
    sentinelNativeClient({
      storage: {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
      },
    });
  return [dashClient(), sentinel] as const;
}
