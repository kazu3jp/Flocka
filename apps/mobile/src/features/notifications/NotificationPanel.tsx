import { useEffect, useState } from "react";
import { Btn, C, Panel, S, T } from "../../components/ui";
import { useAuth } from "../auth/provider";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";
import {
  disablePush,
  enablePush,
  storedPushToken,
} from "./use-push-registration";

export function NotificationPanel() {
  const { api } = useApp();
  const { data } = useAuth();
  const accountId = data?.user.id;
  const [registered, setRegistered] = useState(false);
  const { busy, error, run } = useAction();
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void storedPushToken(accountId).then((token) => {
      if (active) setRegistered(!!token);
    });
    return () => {
      active = false;
    };
  }, [accountId]);
  return (
    <Panel style={S.gap}>
      <T display color={C.ink}>
        通知
      </T>
      <T color={C.muted} size={13}>
        封筒の到着、交換の成立、通報への対応をこの端末へお知らせします。
      </T>
      {error && (
        <T accessibilityRole="alert" color={C.danger}>
          {error}
        </T>
      )}
      <Btn
        disabled={busy || !accountId}
        label={
          busy
            ? "設定中…"
            : registered
              ? "この端末の通知を停止"
              : "この端末で通知を受け取る"
        }
        onPress={() =>
          void run(async () => {
            if (!accountId) return;
            if (registered) await disablePush(api, accountId);
            else await enablePush(api, accountId);
            setRegistered(!registered);
          })
        }
      />
    </Panel>
  );
}
