import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { Btn, C, List, ListRow, S, Sheet, T } from "../../components/ui";
import { useAuth } from "./provider";
import { useSignOut } from "./use-sign-out";

/**
 * The source's me-account list: who is signed in, and ログアウト behind a
 * confirmation. Deleting the account, which cannot be undone, sits apart
 * below it as the one red button.
 */
export function AccountSection() {
  const router = useRouter();
  const { data } = useAuth(),
    [ask, setAsk] = useState(false),
    { busy, error, pushPending, signOut } = useSignOut();
  const logout = async (deferPushUnregister = false) => {
    if (await signOut(deferPushUnregister)) setAsk(false);
  };
  return (
    <>
      <List testID="me-account">
        <ListRow
          icon="lock"
          title="ログイン中のアカウント"
          caption={data?.user.email}
        />
        <ListRow
          icon="back"
          title="ログアウト"
          trailing={null}
          disabled={busy}
          onPress={() => setAsk(true)}
        />
      </List>
      <View style={{ gap: 6, marginTop: 6 }}>
        <Btn
          danger
          small
          icon="trash"
          iconSize={18}
          label="アカウントを削除"
          onPress={() => router.push("/delete-account")}
        />
        <T size={12} color={C.pale} style={{ textAlign: "center" }}>
          元に戻せません。確認メールで手続きします。
        </T>
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
          <View style={[S.row, { marginTop: 2 }]}>
            <Btn
              plain
              label="やめる"
              style={S.fill}
              disabled={busy}
              onPress={() => setAsk(false)}
            />
            <Btn
              label="ログアウト"
              style={S.fill}
              loading={busy}
              onPress={() => void logout()}
            />
          </View>
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
