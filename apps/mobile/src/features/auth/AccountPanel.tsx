import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { Btn, C, Icon, S, Sheet, T } from "../../components/ui";
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
      <View style={[S.row, { marginTop: 10 }]}>
        <Icon name="lock" />
        <View style={S.fill}>
          <T size={12} color={C.pale}>
            アカウント
          </T>
          <T size={13}>{data?.user.email}</T>
        </View>
      </View>
      <Btn
        plain
        small
        label="ログアウト"
        disabled={busy}
        onPress={() => setAsk(true)}
      />
      <Btn
        plain
        small
        label="アカウントを削除"
        onPress={() => router.push("/delete-account")}
      />
      {ask && (
        <Sheet
          title="ログアウトしますか？"
          onClose={() => {
            if (!busy) setAsk(false);
          }}
        >
          <T size={13}>
            この端末のログイン状態を解除します。保存したデータは同じアカウントでログインすると開けます。
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
