import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { Btn, C, Icon, Panel, S, SP, Sheet, T } from "../../components/ui";
import { useAuth } from "./provider";
import { useSignOut } from "./use-sign-out";
export function AccountPanel() {
  const router = useRouter();
  const { data } = useAuth(),
    [ask, setAsk] = useState(false),
    { busy, error, pushPending, signOut } = useSignOut();
  const logout = async (deferPushUnregister = false) => {
    if (await signOut(deferPushUnregister)) setAsk(false);
  };
  return (
    <>
      <Panel>
        <View style={S.row}>
          <Icon name="lock" color={C.ink} />
          <View style={S.fill}>
            <T size={12} color={C.muted}>
              ログイン中のアカウント
            </T>
            <T size={14} color={C.ink}>
              {data?.user.email}
            </T>
          </View>
        </View>
      </Panel>
      <Btn
        plain
        small
        label="ログアウト"
        disabled={busy}
        onPress={() => setAsk(true)}
      />
      <View style={{ gap: SP.sm, marginTop: SP.sm }}>
        <T size={12} color={C.pale}>
          削除すると元に戻せません。確認メールの手続きが必要です。
        </T>
        <Btn
          danger
          small
          label="アカウントを削除"
          onPress={() => router.push("/delete-account")}
        />
      </View>
      {ask && (
        <Sheet
          title="ログアウトしますか？"
          onClose={() => {
            if (!busy) setAsk(false);
          }}
        >
          <T size={14} color={C.muted}>
            もう一度ログインすると、デッキや証言をそのまま使えます。
          </T>
          {error ? <T color={C.danger}>{error}</T> : null}
          <Btn
            plain
            label="やめる"
            disabled={busy}
            onPress={() => setAsk(false)}
          />
          <Btn
            label={busy ? "ログアウト中…" : "ログアウト"}
            disabled={busy}
            onPress={() => void logout()}
          />
          {pushPending && (
            <Btn
              plain
              label="通知の解除を後で再試行してログアウト"
              disabled={busy}
              onPress={() => void logout(true)}
            />
          )}
        </Sheet>
      )}
    </>
  );
}
