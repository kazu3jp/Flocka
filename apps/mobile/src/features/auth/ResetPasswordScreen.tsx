import React, { useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Board, Btn, C, Header, T } from "../../components/ui";
import { PasswordField, validPassword } from "./fields";
import { assertAuthResult, getAuthClient } from "./client";
import { useAuth } from "./provider";
export function ResetPasswordScreen() {
  const { token, error: linkError } = useLocalSearchParams<{
      token?: string;
      error?: string;
    }>(),
    router = useRouter(),
    { refetch } = useAuth(),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<string | null>(null),
    running = useRef(false);
  const reset = async () => {
    if (!token || running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      assertAuthResult(
        await getAuthClient().resetPassword({ token, newPassword: password }),
      );
      setPassword("");
      setDone(true);
      // A session held before the reset may have been revoked; read it again so
      // the next screen does not trust a stale one. Failure is shown by the auth routes.
      await refetch().catch(() => {});
    } catch (error) {
      setError(error instanceof Error ? error.message : "再設定に失敗しました");
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <Board scroll>
      <Header title="パスワードの再設定" />
      <T display size={26}>
        {done ? "パスワードを変更しました。" : "新しいパスワードを設定"}
      </T>
      {done ? (
        <>
          <T color={C.pale}>新しいパスワードでログインしてください。</T>
          <Btn label="ログインへ" onPress={() => router.replace("/auth")} />
        </>
      ) : !token || linkError ? (
        <>
          <T color={C.yellow}>
            リンクが無効か有効期限が切れています。再設定メールをもう一度送信してください。
          </T>
          <Btn label="ログインへ戻る" onPress={() => router.replace("/auth")} />
        </>
      ) : (
        <>
          <PasswordField value={password} onChange={setPassword} signup />
          <Btn
            label={busy ? "変更中…" : "パスワードを変更"}
            disabled={busy || !validPassword(password)}
            onPress={() => void reset()}
          />
        </>
      )}
      {error ? (
        <T accessibilityRole="alert" color={C.yellow}>
          {error}
        </T>
      ) : null}
    </Board>
  );
}
