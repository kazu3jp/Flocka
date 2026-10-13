import React, { useEffect, useRef, useState } from "react";
import { ApiClientError, FlockaApiClient } from "@flocka/api-client";
import type { State } from "@flocka/domain";
import { Btn, C, Panel, S, T } from "../../components/ui";
import { useConfirmation } from "../../components/pickers";
import { useApp } from "../../store";
import { readSession, saveSession } from "./session-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
export function BackupPanel() {
  return API_URL ? <ConnectedBackupPanel apiUrl={API_URL} /> : null;
}
function ConnectedBackupPanel({ apiUrl }: { apiUrl: string }) {
  const { s, demo, update, toast } = useApp(),
    [token, setToken] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [storageReady, setStorageReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState<number | null>(null),
    { ask, dialog } = useConfirmation();
  const mounted = useRef(false),
    inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    readSession(apiUrl)
      .then((token) => {
        if (active) {
          setToken(token);
          setStorageReady(true);
        }
      })
      .catch((error) => {
        if (active) setError(String(error.message || error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [apiUrl]);
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current || !mounted.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (error) {
      if (mounted.current)
        setError(error instanceof Error ? error.message : String(error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const client = () => new FlockaApiClient(apiUrl, token || undefined, __DEV__);
  const getRevision = async (api: FlockaApiClient) => {
    try {
      return (await api.getBackup()).revision;
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "BACKUP_NOT_FOUND")
        return null;
      throw error;
    }
  };
  const connect = () =>
    run(async () => {
      if (token) {
        await client().getMe();
        await saveSession(apiUrl, token);
        const revision = await getRevision(client());
        if (mounted.current) setRevision(revision);
        toast("APIへの接続を確認しました");
        return;
      }
      const session = await client().createAccount(s.profile, s.self);
      if (mounted.current) setToken(session.token);
      await saveSession(apiUrl, session.token);
      toast("端末のセッションを作成しました");
    });
  const upload = () =>
    run(async () => {
      const api = client();
      await api.updateProfile(s.profile, s.self);
      let avatarKey: string | null = null;
      if (s.profile.avatar.type === "photo") {
        if (!s.profile.avatar.photo)
          throw new Error("写真データがないためバックアップできません");
        avatarKey = await api.uploadAvatar(s.profile.avatar.photo);
      }
      const saved = await api.saveBackup(s, revision, avatarKey);
      if (mounted.current) setRevision(saved.revision);
      toast(
        avatarKey
          ? "デッキと写真をバックアップしました"
          : "デッキをバックアップしました",
      );
    });
  const download = () =>
    run(async () => {
      const api = client(),
        saved = await api.getBackup(),
        snapshot: State = saved.snapshot;
      if (snapshot.profile.avatar.type === "photo")
        snapshot.profile.avatar.photo = await api.getAvatar(true);
      if (!mounted.current) return;
      update((state) => Object.assign(state, snapshot));
      if (mounted.current) setRevision(saved.revision);
      toast("バックアップを復元しました");
    });
  return (
    <>
      <Panel style={S.gap}>
        <T display color={C.ink} size={18}>
          バックアップ
        </T>
        <T color={C.muted} size={12}>
          プロフィールとデッキ、写真をサーバーに保存します。操作したときだけ送信します。
        </T>
        {demo ? (
          <T color={C.muted} size={13}>
            サンプル体験中はバックアップを操作できません。
          </T>
        ) : (
          <>
            <Btn
              small
              label={token ? "接続を確認する" : "APIに接続する"}
              disabled={loading || busy || !storageReady}
              onPress={() => void connect()}
            />
            {token && (
              <>
                <Btn
                  small
                  label="バックアップを保存"
                  disabled={busy}
                  onPress={() =>
                    ask(
                      "サーバーに保存する？",
                      "この端末のデッキと写真を、設定されたAPIに保存します。",
                      () => {
                        void upload();
                      },
                      "保存する",
                    )
                  }
                />
                <Btn
                  small
                  plain
                  label="バックアップを復元"
                  disabled={busy}
                  onPress={() =>
                    ask(
                      "バックアップを復元する？",
                      "この端末のデッキをサーバーの保存内容に置き換えます。",
                      () => {
                        void download();
                      },
                      "復元する",
                    )
                  }
                />
              </>
            )}
          </>
        )}
        {error && (
          <T color={C.danger} size={13}>
            {error}
          </T>
        )}
      </Panel>
      {dialog}
    </>
  );
}
