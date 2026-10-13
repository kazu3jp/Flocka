import React, { useEffect, useRef, useState } from "react";
import { ApiClientError, FlockaApiClient } from "@flocka/api-client";
import type { State } from "@flocka/domain";
import { Btn, C, Panel, S, T } from "../../components/ui";
import { useConfirmation } from "../../components/pickers";
import { useApp } from "../../store";

export function BackupPanel() {
  const { s, update, toast, api, refresh } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState<number | null>(null),
    { ask, dialog } = useConfirmation();
  const mounted = useRef(false),
    inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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
  const client = () => api;
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
      await client().getMe();
      const revision = await getRevision(client());
      if (mounted.current) setRevision(revision);
      toast("APIへの接続を確認しました");
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
      await api.updateProfile(snapshot.profile, snapshot.self);
      if (
        snapshot.profile.avatar.type === "photo" &&
        snapshot.profile.avatar.photo
      )
        await api.uploadAvatar(snapshot.profile.avatar.photo);
      update((state) => {
        state.showcase = snapshot.showcase;
        state.resp = snapshot.resp;
        state.deco = snapshot.deco;
        state.prDraft = snapshot.prDraft;
      });
      await refresh();
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
        <>
          <Btn
            small
            label="接続を確認する"
            disabled={busy}
            onPress={() => void connect()}
          />
          {
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
                    "プロフィール・装飾・自己PR下書きを復元します。交換相手や届いた証言は現在のサーバー情報を維持します。",
                    () => {
                      void download();
                    },
                    "復元する",
                  )
                }
              />
            </>
          }
        </>{" "}
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
