import { useRef, useState } from "react";
import { leavePushDevice } from "../notifications/use-push-registration";
import { useApp } from "../../store";
import { assertAuthResult, getAuthClient } from "./client";
import { useAuth } from "./provider";

const PUSH_PENDING_MESSAGE =
  "この端末の通知の登録を解除できませんでした。このままログアウトすると、次に同じアカウントでログインしたときに解除を再試行します。";

/** Sign-out that never reports a device as unregistered when the server kept it. */
export function useSignOut() {
  const { api } = useApp();
  const { data, refetch } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [pushPending, setPushPending] = useState(false),
    running = useRef(false);
  const signOut = async (deferPushUnregister = false) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const accountId = data?.user.id;
      if (accountId) {
        try {
          await leavePushDevice(api, accountId, deferPushUnregister);
        } catch {
          setPushPending(true);
          setError(PUSH_PENDING_MESSAGE);
          return false;
        }
      }
      assertAuthResult(await getAuthClient().signOut());
      setPushPending(false);
      await refetch();
      return true;
    } catch {
      setError(
        "ログアウトできませんでした。通信を確認して再試行してください。",
      );
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return { busy, error, pushPending, signOut };
}
