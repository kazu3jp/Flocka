import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import type { FlockaApiClient } from "@flocka/api-client";
import { UserFacingError, userFacingError } from "../sync/user-facing-error";
import { createDeviceTokenChangeFilter } from "./device-token-change";
import { parsePendingTokens } from "./pending-tokens";

const deviceKey = (accountId: string) => `flocka:push-device:${accountId}`;
/** Tokens this account still has to remove from the server after a failed unregister. */
const pendingUnregisterKey = (accountId: string) =>
  `flocka:push-unregister:${accountId}`;
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
/** The device token is one per device, whichever account registers it. */
const deviceTokens = createDeviceTokenChangeFilter();
export const storedPushToken =(accountId: string) =>
  AsyncStorage.getItem(deviceKey(accountId));

async function pendingUnregisters(accountId: string) {
  return parsePendingTokens(
    await AsyncStorage.getItem(pendingUnregisterKey(accountId)),
  );
}
async function rememberPendingUnregister(accountId: string, token: string) {
  const pending = await pendingUnregisters(accountId);
  if (!pending.includes(token))
    await AsyncStorage.setItem(
      pendingUnregisterKey(accountId),
      JSON.stringify([...pending, token]),
    );
}

/** Retry removing tokens left registered by an earlier failure. */
async function retryPendingUnregisters(
  api: FlockaApiClient,
  accountId: string,
) {
  const pending = await pendingUnregisters(accountId);
  if (pending.length === 0) return;
  const current = await storedPushToken(accountId);
  const remaining: string[] = [];
  for (const token of pending) {
    // A token registered again later belongs to the current registration.
    if (token === current) continue;
    try {
      await api.unregisterPushDevice(token);
    } catch {
      remaining.push(token);
    }
  }
  if (remaining.length > 0)
    await AsyncStorage.setItem(
      pendingUnregisterKey(accountId),
      JSON.stringify(remaining),
    );
  else await AsyncStorage.removeItem(pendingUnregisterKey(accountId));
  if (remaining.length > 0)
    throw new UserFacingError(
      "以前の通知登録を解除できませんでした。次回の起動時に再試行します。",
    );
}

async function registerPush(
  api: FlockaApiClient,
  accountId: string,
  requestPermission = true,
) {
  if (Platform.OS === "web" || !Device.isDevice)
    throw new UserFacingError("通知はスマートフォンのアプリで設定できます。");
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId)
    throw new UserFacingError("このアプリではまだ通知を利用できません。");
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
    throw new UserFacingError(
      "通知が許可されていません。端末の設定から変更できます。",
    );
  }
  const devicePushToken = await Notifications.getDevicePushTokenAsync();
  deviceTokens.remember(devicePushToken.data);
  const token = (
    await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken })
  ).data;
  const previous = await storedPushToken(accountId);
  await api.registerPushDevice(
    token,
    Platform.OS === "ios" ? "ios" : "android",
  );
  await AsyncStorage.setItem(deviceKey(accountId), token);
  // The new token works even if the old one cannot be removed yet; retry that later.
  if (previous && previous !== token)
    await api
      .unregisterPushDevice(previous)
      .catch(() => rememberPendingUnregister(accountId, previous));
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

/**
 * Sign-out unregisters this device. When the server cannot be reached and the
 * user still signs out, the token is kept as pending and removed the next time
 * the same account is active here; it is never reported as removed.
 */
export function leavePushDevice(
  api: FlockaApiClient,
  accountId: string,
  deferOnFailure: boolean,
): Promise<"none" | "unregistered" | "deferred"> {
  return serializeDevice(accountId, async () => {
    const token = await storedPushToken(accountId);
    if (!token) return "none";
    try {
      await api.unregisterPushDevice(token);
    } catch (error) {
      if (!deferOnFailure) throw error;
      await rememberPendingUnregister(accountId, token);
      await AsyncStorage.removeItem(deviceKey(accountId));
      return "deferred";
    }
    await AsyncStorage.removeItem(deviceKey(accountId));
    return "unregistered";
  });
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
    const refreshRegistration = async () => {
      try {
        // A stale token that still cannot be removed must not stop the current one.
        let pendingFailure: unknown = null;
        await serializeDevice(accountId, () =>
          retryPendingUnregisters(api, accountId),
        ).catch((error: unknown) => {
          pendingFailure = error;
        });
        if (active && (await storedPushToken(accountId)))
          await enablePush(api, accountId, false);
        if (pendingFailure) throw pendingFailure;
      } catch (error) {
        if (active) onError(userFacingError(error, "通知の登録に失敗しました"));
      }
    };
    void refreshRegistration();
    // The OS can rotate the device token; register the Expo token derived from it again.
    const rotation = Notifications.addPushTokenListener((token) => {
      if (active && deviceTokens.changed(token.data)) void refreshRegistration();
    });
    return () => {
      active = false;
      rotation.remove();
    };
  }, [api, accountId, enabled, onError]);
}

/** Server-side account deletion already unregisters every destination. */
export function forgetDeletedPushDevice(accountId: string) {
  return serializeDevice(accountId, () =>
    AsyncStorage.multiRemove([
      deviceKey(accountId),
      pendingUnregisterKey(accountId),
    ]),
  );
}
