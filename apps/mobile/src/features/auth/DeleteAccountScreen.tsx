import React, { useState } from "react";
import { Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Board, Btn, C, Choice, Header, T } from "../../components/ui";
import { AuthScreen } from "./AuthScreen";
import { useAccountDeletion } from "./use-account-deletion";
import { SessionStatus, useAuth } from "./provider";

export function DeleteAccountScreen() {
  const { token: parameter } = useLocalSearchParams<{ token?: string }>();
  const token = typeof parameter === "string" ? parameter : undefined;
  const auth = useAuth(),
    router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const callbackURL =
    Platform.OS === "web"
      ? new URL("/delete-account", window.location.origin).href
      : "flocka://delete-account";
  const {
    outcome,
    cleanupError,
    busy,
    sent,
    error,
    submitDeletion,
    retryCleanup,
    dismissOutcome,
  } = useAccountDeletion(token, callbackURL);
  if (outcome)
    return (
      <Board scroll>
        <Header title="アカウント削除" />
        <T display size={24}>
          {outcome === "completed"
            ? "アカウントを削除しました"
            : "アカウントの削除を処理中です"}
        </T>
        <T>
          {outcome === "completed"
            ? "プロフィール、写真、交換履歴、送受信した証言、バックアップとログイン情報を削除しました。"
            : "削除を受け付け、ログイン情報を無効にしました。写真や外部ログイン連携を含む削除が完了するまで、サーバーで再試行します。"}
        </T>
        {cleanupError && (
          <>
            <T accessibilityRole="alert" color={C.yellow}>
              この端末の保存データを消去できませんでした：{cleanupError}
            </T>
            <Btn
              label="端末のデータ消去を再試行"
              onPress={() => void retryCleanup()}
            />
          </>
        )}
        <Btn
          label="ログイン画面へ"
          onPress={() => {
            dismissOutcome();
            router.replace("/auth");
          }}
        />
      </Board>
    );
  if (auth.isPending || auth.error) return <SessionStatus />;
  if (!auth.data)
    return (
      <AuthScreen
        initialView="login"
        destination={{
          pathname: "/delete-account",
          params: token ? { token } : {},
        }}
        returnURL={
          token
            ? `${callbackURL}?token=${encodeURIComponent(token)}`
            : callbackURL
        }
      />
    );
  return (
    <Board scroll>
      <Header title="アカウント削除" onBack={() => router.replace("/me")} />
      <T display size={24}>
        {token ? "削除を確定しますか？" : "アカウントを削除する"}
      </T>
      <T size={13} color={C.pale}>
        {auth.data.user.email}
      </T>
      <T>
        プロフィール、写真、交換履歴、送受信した証言、設定、自己PRの下書き、バックアップを削除します。サーバー上の相手側の交換・証言とバックアップ内の関連データも削除し、すべての端末からログアウトします。元に戻せません。
      </T>
      {(!token || sent) && (
        <T size={13}>
          {sent
            ? "確認メールを送信しました。30分以内にリンクを開き、このアカウントで削除を確定してください。"
            : "本人確認のため、登録済みメールアドレスに確認リンクを送ります。リンクを開くだけでは削除されません。"}
        </T>
      )}
      {token && (
        <Choice
          label="削除すると元に戻せないことを確認しました"
          selected={agreed}
          onPress={() => setAgreed(!agreed)}
        />
      )}
      {error && (
        <T accessibilityRole="alert" color={C.yellow}>
          {error}
        </T>
      )}
      {token && error && (
        <Btn
          plain
          small
          label="新しい確認メールを送信"
          disabled={busy}
          onPress={() => void submitDeletion(false)}
        />
      )}
      <Btn
        label={
          busy
            ? "処理中…"
            : token
              ? "アカウントを完全に削除"
              : sent
                ? "確認メールを再送"
                : "確認メールを送信"
        }
        disabled={busy || (Boolean(token) && !agreed)}
        onPress={() => void submitDeletion()}
      />
      <Btn
        plain
        label="削除せずに戻る"
        disabled={busy}
        onPress={() => router.replace("/me")}
      />
    </Board>
  );
}
