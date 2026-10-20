import { useRouter } from "expo-router";
import { disablePush } from "../notifications/use-push-registration";
import { useApp } from "../../store";
import React, { useState } from "react";
import { View } from "react-native";
import { Btn, C, Icon, S, Sheet, T } from "../../components/ui";
import { useAuth } from "./provider";
import { assertAuthResult, getAuthClient } from "./client";
export function AccountPanel() {
  const { api } = useApp();
  const router = useRouter();
  const { data, refetch } = useAuth(),
    [ask, setAsk] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const logout = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Leaving this device must not depend on the server forgetting it. A failed
      // unregister keeps the stored token, so nothing reports notifications as stopped.
      if (data?.user.id) await disablePush(api, data.user.id).catch(() => {});
      assertAuthResult(await getAuthClient().signOut());
      await refetch();
      setAsk(false);
    } catch {
      setError(
        "ログアウトできませんでした。通信を確認して再試行してください。",
      );
    } finally {
      setBusy(false);
    }
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
          {error && <T color={C.danger}>{error}</T>}
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
        </Sheet>
      )}
    </>
  );
}
