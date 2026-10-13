import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import type { FlockaApiClient } from "@flocka/api-client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function requestExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as
    string | undefined;
  if (!projectId) return null;
  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "お知らせ",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/**
 * Registers this device for push notifications once the player is signed in.
 * Unsupported environments (web, simulators, missing EAS project) are skipped;
 * a real registration failure is reported through onError.
 */
export function usePushRegistration(
  api: FlockaApiClient,
  enabled: boolean,
  onError: (message: string) => void,
) {
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await requestExpoPushToken();
        if (!token || cancelled) return;
        await api.registerPushDevice(
          token,
          Platform.OS === "ios" ? "ios" : "android",
        );
      } catch (error) {
        if (!cancelled)
          onError(
            error instanceof Error
              ? `通知の登録に失敗しました: ${error.message}`
              : "通知の登録に失敗しました",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, enabled, onError]);
}
