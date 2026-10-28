import { useEffect, useState } from "react";
import { useApp } from "../../store";
import { useAuth } from "../auth/provider";
import { useAction } from "../sync/use-action";
import { UserFacingError, userFacingError } from "../sync/user-facing-error";
import {
  disablePush,
  enablePush,
  storedPushToken,
} from "./use-push-registration";

/**
 * Whether this device receives notifications, and turning that on or off.
 * The switch follows what is actually registered: a failed change keeps the
 * old state and says why.
 */
export function useDeviceNotifications() {
  const { api } = useApp();
  const { data } = useAuth();
  const accountId = data?.user.id;
  const [registered, setRegistered] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void storedPushToken(accountId).then(
      (token) => {
        if (active) setRegistered(!!token);
      },
      () => {
        if (active) setLoadError("この端末の通知設定を読み込めませんでした");
      },
    );
    return () => {
      active = false;
    };
  }, [accountId]);
  const toggle = () =>
    void run(async () => {
      if (!accountId) return;
      try {
        if (registered) await disablePush(api, accountId);
        else await enablePush(api, accountId);
      } catch (failure) {
        throw new UserFacingError(
          userFacingError(failure, "通知を設定できませんでした"),
        );
      }
      setRegistered(!registered);
      setLoadError(null);
    });
  return {
    registered,
    busy,
    disabled: busy || !accountId,
    error: error || loadError,
    toggle,
  };
}
