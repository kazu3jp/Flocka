import React from "react";
import { Btn, C, T } from "../../components/ui";
import { useSignOut } from "./use-sign-out";

/** Lets a user stuck on a startup error leave this account. */
export function SignOutAction() {
  const { busy, error, pushPending, signOut } = useSignOut();
  return (
    <>
      {error ? (
        <T accessibilityRole="alert" color={C.yellow} size={13}>
          {error}
        </T>
      ) : null}
      <Btn
        plain
        label={busy ? "ログアウト中…" : "ログアウト"}
        disabled={busy}
        onPress={() => void signOut()}
      />
      {pushPending && (
        <Btn
          plain
          label="通知の解除を後で再試行してログアウト"
          disabled={busy}
          onPress={() => void signOut(true)}
        />
      )}
    </>
  );
}
