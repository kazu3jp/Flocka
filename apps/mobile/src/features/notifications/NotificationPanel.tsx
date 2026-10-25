import { useEffect, useState } from "react";
import { Btn, C, InlineError, Panel, S, T } from "../../components/ui";
import { useAuth } from "../auth/provider";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";
import { userFacingError } from "../sync/user-facing-error";
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
  return (
    <Panel style={S.gap}>
      <T color={C.muted} size={13}>
        封筒の到着、交換の成立、通報への対応をこの端末へお知らせします。
      </T>
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
            try {
              if (registered) await disablePush(api, accountId);
              else await enablePush(api, accountId);
            } catch (error) {
              throw new Error(
                userFacingError(error, "通知を設定できませんでした"),
              );
            }
            setRegistered(!registered);
            setLoadError(null);
          })
        }
      />
      <InlineError
        text={error || loadError}
        color={C.danger}
        reserveLines={2}
      />
    </Panel>
  );
}
