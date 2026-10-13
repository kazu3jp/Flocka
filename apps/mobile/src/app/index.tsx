import { useAuth, SessionStatus } from "../features/auth/provider";
import React from "react";
import { Redirect } from "expo-router";
import { Board, Btn, C, T } from "../components/ui";
import { currentEntry, routeFor, useApp } from "../store";
export default function Index() {
  const auth = useAuth();
  const { ready, error, s, n, reload } = useApp();
  if (auth.isPending || auth.error) return <SessionStatus />;
  if (!auth.data) return <Redirect href="/auth" />;
  if (error)
    return (
      <Board>
        <T>{error}</T>
        <T size={13}>保存データは上書きしていません。</T>
        <Btn label="もう一度読み込む" onPress={reload} />
      </Board>
    );
  if (!ready)
    return (
      <Board>
        <T color={C.pale}>デッキを読み込み中…</T>
      </Board>
    );
  return (
    <Redirect
      href={routeFor(s.onboarded ? currentEntry(n) : { id: "onboarding" })}
    />
  );
}
