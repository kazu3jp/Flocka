import React, { useEffect, useRef, useState } from "react";
import { ApiClientError, FlockaApiClient } from "@flocka/api-client";
import type { State } from "@flocka/domain";
import { Btn, C, Panel, S, T } from "../../components/ui";
import { useConfirmation } from "../../components/pickers";
import { useApp } from "../../store";
import { UserFacingError, userFacingError } from "./user-facing-error";
import { backupSnapshotOf, withRestoredPreferences } from "./backup-snapshot";

type BackupVersion = { revision: number; updatedAt: string };

/** Run one restore step and name it in the error, so a partial restore is never silent. */
async function restoreStep<T>(failure: string, step: () => Promise<T>) {
  try {
    return await step();
  } catch (error) {
    throw new UserFacingError(
      `${failure}（${userFacingError(error, "通信を確認してください")}）`,
    );
  }
}

export function BackupPanel() {
  const { s, update, toast, api, refresh } = useApp(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    // undefined: not checked yet; null: the server has no backup.
    [latest, setLatest] = useState<BackupVersion | null | undefined>(undefined),
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
        setError(userFacingError(error, "バックアップを処理できませんでした"));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const client = () => api;
  const getLatest = async (
    api: FlockaApiClient,
  ): Promise<BackupVersion | null> => {
    try {
      const { revision, updatedAt } = await api.getBackup();
      return { revision, updatedAt };
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "BACKUP_NOT_FOUND")
        return null;
      throw error;
    }
  };
  const connect = () =>
    run(async () => {
      await client().getMe();
      const current = await getLatest(client());
      if (mounted.current) setLatest(current);
      toast("APIへの接続を確認しました");
    });
  const upload = (base: BackupVersion | null) =>
    run(async () => {
      const api = client();
      await api.updateProfile(s.profile, s.self);
      let avatarKey: string | null = null;
      if (s.profile.avatar.type === "photo") {
        if (!s.profile.avatar.photo)
          throw new UserFacingError(
            "写真データがないためバックアップできません",
          );
        avatarKey = await api.uploadAvatar(s.profile.avatar.photo);
      }
      try {
        const saved = await api.saveBackup(
          backupSnapshotOf(s),
          base?.revision ?? null,
          avatarKey,
        );
        if (mounted.current)
          setLatest({ revision: saved.revision, updatedAt: saved.updatedAt });
      } catch (error) {
        if (!(error instanceof ApiClientError && error.status === 409))
          throw error;
        // Another device saved in between; show its version before any overwrite.
        const current = await getLatest(api).catch(() => undefined);
        if (mounted.current) setLatest(current);
        throw new UserFacingError(
          "別の端末でバックアップが更新されました。上書きする場合は、もう一度「バックアップを保存」を押してください",
        );
      }
      toast(
        avatarKey
          ? "デッキと写真をバックアップしました"
          : "デッキをバックアップしました",
      );
    });
  const confirmUpload = () =>
    run(async () => {
      const current = await getLatest(client());
      if (!mounted.current) return;
      setLatest(current);
      ask(
        "サーバーに保存する？",
        current
          ? `この端末のデッキと写真で、${new Date(current.updatedAt).toLocaleString("ja-JP")}のバックアップを上書きします。`
          : "この端末のデッキと写真を、設定されたAPIに保存します。",
        () => {
          void upload(current);
        },
        "保存する",
      );
    });
  const download = () =>
    run(async () => {
      const api = client();
      // Read everything first; nothing changes until the backup is fully loaded.
      const saved = await restoreStep(
          "バックアップを読み込めませんでした。何も変更していません",
          () => api.getBackup(),
        ),
        snapshot: State = saved.snapshot;
      if (snapshot.profile.avatar.type === "photo")
        snapshot.profile.avatar.photo = await restoreStep(
          "バックアップの写真を読み込めませんでした。何も変更していません",
          () => api.getAvatar(true),
        );
      if (!mounted.current) return;
      if (
        snapshot.profile.avatar.type === "photo" &&
        snapshot.profile.avatar.photo
      ) {
        const photo = snapshot.profile.avatar.photo;
        await restoreStep(
          "写真を復元できませんでした。プロフィールと下書きは変更していません",
          () => api.uploadAvatar(photo),
        );
      }
      await restoreStep(
        "プロフィールを復元できませんでした。写真以外は変更していません",
        () => api.updateProfile(snapshot.profile, snapshot.self),
      );
      // Preferences are saved to the server by the regular preference sync.
      update((state) => {
        Object.assign(state, withRestoredPreferences(state, snapshot));
      });
      if (mounted.current)
        setLatest({ revision: saved.revision, updatedAt: saved.updatedAt });
      await restoreStep(
        "バックアップを復元しましたが、最新の状態を読み込めませんでした",
        () => refresh(),
      );
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
        {latest !== undefined && (
          <T color={C.muted} size={12}>
            {latest
              ? `前回のバックアップ：${new Date(latest.updatedAt).toLocaleString("ja-JP")}`
              : "サーバーにバックアップはまだありません"}
          </T>
        )}
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
                onPress={() => void confirmUpload()}
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
        {error ? (
          <T color={C.danger} size={13}>
            {error}
          </T>
        ) : null}
      </Panel>
      {dialog}
    </>
  );
}
