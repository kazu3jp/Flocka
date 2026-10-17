import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import type { FlockaApiClient } from "@flocka/api-client";

const deviceKey = (accountId: string) => `flocka:push-device:${accountId}`;
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
export const storedPushToken = (accountId: string) =>
  AsyncStorage.getItem(deviceKey(accountId));

async function registerPush(
  api: FlockaApiClient,
  accountId: string,
  requestPermission = true,
) {
  if (Platform.OS === "web" || !Device.isDevice)
    throw new Error("通知はスマートフォンのアプリで設定できます。");
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) throw new Error("このアプリではまだ通知を利用できません。");
  // Android must create a channel before displaying the permission dialog.
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "お知らせ",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    await unregisterPush(api, accountId);
    throw new Error("通知が許可されていません。端末の設定から変更できます。");
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const previous = await storedPushToken(accountId);
  if (previous && previous !== token) await api.unregisterPushDevice(previous);
  await api.registerPushDevice(
    token,
    Platform.OS === "ios" ? "ios" : "android",
  );
  await AsyncStorage.setItem(deviceKey(accountId), token);
  return token;
}

async function unregisterPush(api: FlockaApiClient, accountId: string) {
  const token = await storedPushToken(accountId);
  if (token) await api.unregisterPushDevice(token);
  await AsyncStorage.removeItem(deviceKey(accountId));
}

// Serialize device changes so logout waits for an in-flight registration.
const deviceOperations = new Map<string, Promise<unknown>>();
function serializeDevice<T>(
  accountId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const pending = (deviceOperations.get(accountId) ?? Promise.resolve())
    .catch(() => {})
    .then(operation);
  deviceOperations.set(accountId, pending);
  void pending
    .finally(() => {
      if (deviceOperations.get(accountId) === pending)
        deviceOperations.delete(accountId);
    })
    .catch(() => {});
  return pending;
}
export function enablePush(
  api: FlockaApiClient,
  accountId: string,
  requestPermission = true,
) {
  return serializeDevice(accountId, () =>
    registerPush(api, accountId, requestPermission),
  );
}
export function disablePush(api: FlockaApiClient, accountId: string) {
  return serializeDevice(accountId, () => unregisterPush(api, accountId));
}

/** Refresh only a device whose owner explicitly enabled notifications. */
export function usePushRegistration(
  api: FlockaApiClient,
  accountId: string,
  enabled: boolean,
  onError: (message: string) => void,
) {
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    let active = true;
    void (async () => {
      try {
        if (await storedPushToken(accountId)) {
          if (active) await enablePush(api, accountId, false);
        }
      } catch (error) {
        if (active)
          onError(
            error instanceof Error ? error.message : "通知の登録に失敗しました",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [api, accountId, enabled, onError]);
}

/** Server-side account deletion already unregisters every destination. */
export function forgetDeletedPushDevice(accountId: string) {
  return serializeDevice(accountId, () =>
    AsyncStorage.removeItem(deviceKey(accountId)),
  );
}
