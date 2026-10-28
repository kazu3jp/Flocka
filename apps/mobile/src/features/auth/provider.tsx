import { DeletionOutcomeProvider } from "./deletion-outcome";
import React, { createContext, useContext } from "react";
import { Board, Btn, T } from "../../components/ui";
import { LaunchCover } from "../../components/loading";
import { API_URL, getAuthClient } from "./client";

type AuthSession = ReturnType<ReturnType<typeof getAuthClient>["useSession"]>;
const Context = createContext<AuthSession | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!API_URL)
    return (
      <Board>
        <T>認証APIの接続先を設定してください。</T>
        <T size={13}>
          apps/mobile/.env.local に EXPO_PUBLIC_API_URL
          を設定し、Expoを再起動してください。
        </T>
      </Board>
    );
  return <ConfiguredAuthProvider>{children}</ConfiguredAuthProvider>;
}
function ConfiguredAuthProvider({ children }: { children: React.ReactNode }) {
  const session = getAuthClient().useSession();
  return (
    <Context.Provider value={session}>
      <DeletionOutcomeProvider>{children}</DeletionOutcomeProvider>
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProviderが必要です");
  return value;
}
export function SessionStatus() {
  const { error, refetch } = useAuth();
  if (!error) return <LaunchCover label="ログイン状態を確認中" />;
  return (
    <Board>
      <T>
        ログイン状態を確認できませんでした。通信とAPI設定を確認してください。
      </T>
      <Btn label="再試行" onPress={() => void refetch()} />
    </Board>
  );
}
