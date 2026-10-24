import { NotificationPanel } from "../notifications/NotificationPanel";
import { LegalDocument } from "../auth/LegalDocument";
import type { LegalTitle } from "@flocka/domain";
import { useAction } from "../sync/use-action";
import { useState } from "react";
import { Switch, View } from "react-native";
import { useConfirmation } from "../../components/pickers";
import {
  Board,
  Btn,
  C,
  Header,
  LinkButton,
  Panel,
  S,
  T,
  Sheet,
} from "../../components/ui";
import { useApp, useAppStatus } from "../../store";
import { usePullRefresh } from "../refresh/use-pull-refresh";

type SettingsAction =
  "sync" | "save" | `unblock:${string}` | `withdraw:${string}`;

export function Settings() {
  const { s, api, refresh, nav, toast, peers, isAdmin } = useApp(),
    { syncing } = useAppStatus(),
    [legal, setLegal] = useState<LegalTitle | null>(null),
    // Unsaved edits only; otherwise the switches follow the latest server settings.
    [draft, setDraft] = useState<typeof s.settings | null>(null),
    { busy, error, run } = useAction(),
    { ask, dialog } = useConfirmation(),
    pull = usePullRefresh(),
    // Which action is running, so only its button shows progress.
    [active, setActive] = useState<SettingsAction | null>(null);
  const settings = draft ?? s.settings;
  const changed = (Object.keys(s.settings) as (keyof typeof s.settings)[]).some(
    (key) => settings[key] !== s.settings[key],
  );
  const runAction = (action: SettingsAction, task: () => Promise<void>) => {
    setActive(action);
    void run(task).finally(() => setActive(null));
  };
  return (
    <Board scroll refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      <Header title="公開範囲・安全" onBack={nav.pop} />
      <View style={S.row}>
        <LinkButton label="利用規約" onPress={() => setLegal("利用規約")} />
        <LinkButton
          label="プライバシーポリシー"
          onPress={() => setLegal("プライバシーポリシー")}
        />
      </View>
      {legal && (
        <Sheet title={legal} onClose={() => setLegal(null)}>
          <LegalDocument title={legal} />
        </Sheet>
      )}
      <NotificationPanel />
      <Btn
        plain
        small
        label={syncing ? "同期中…" : "サーバーと同期"}
        loading={active === "sync"}
        disabled={syncing || busy}
        onPress={() =>
          runAction("sync", async () => {
            await refresh();
            toast("サーバーと同期しました");
          })
        }
      />
      {error ? (
        <T accessibilityRole="alert" color={C.yellow}>
          {error}
        </T>
      ) : null}
      <Panel style={S.gap}>
        {(
          [
            ["allowVibe", "印象を受け取る"],
            ["allowProof", "場面のメモを受け取る"],
            ["onlyConnected", "交換した人からだけ"],
          ] as const
        ).map(([k, label]) => (
          <View style={S.row} key={k}>
            <T color={C.ink} style={S.fill}>
              {label}
            </T>
            <Switch
              accessibilityLabel={label}
              value={settings[k]}
              onValueChange={(v) => setDraft({ ...settings, [k]: v })}
              trackColor={{ true: C.blue, false: C.grey }}
            />
          </View>
        ))}
      </Panel>
      <Btn
        label="設定を保存"
        loading={active === "save"}
        disabled={busy || !changed}
        onPress={() =>
          ask(
            "受け取り設定を変更する？",
            "変更は今後届く封筒に適用します。",
            () =>
              runAction("save", async () => {
                await api.saveSettings(settings);
                await refresh();
                setDraft(null);
                toast("設定を保存しました");
              }),
            "保存する",
          )
        }
      />
      <T display size={18}>
        ブロック中
      </T>
      {s.blocked.length ? (
        s.blocked.map((id) => {
          // Never show a raw account id when the profile is unavailable.
          const name = peers[id]?.profile.name || "名前を取得できない相手";
          return (
            <Btn
              key={id}
              plain
              label={`${name}のブロックを解除`}
              loading={active === `unblock:${id}`}
              disabled={busy}
              onPress={() =>
                ask(
                  "ブロックを解除する？",
                  `${name}の証言が、デッキ・自己PR・交換一覧に戻ります。`,
                  () =>
                    runAction(`unblock:${id}`, async () => {
                      await api.unblock(id);
                      await refresh();
                      toast("ブロックを解除しました");
                    }),
                  "解除する",
                )
              }
            />
          );
        })
      ) : (
        <T size={13}>ブロックしている人はいません。</T>
      )}
      <T display size={18}>
        通報・削除依頼の履歴
      </T>
      {(["reports", "deletions"] as const).map((k) =>
        s[k].map((r) => (
          <Panel key={r.id ?? k + r.at}>
            <T color={C.ink} size={13}>
              {k === "reports" ? "通報" : "削除依頼"} · {r.reason || "削除依頼"}{" "}
              ·{" "}
              {r.withdrawn
                ? "取り下げ済み"
                : r.status === "pending"
                  ? "受付済み"
                  : r.status === "removed"
                    ? "削除済み"
                    : r.status === "rejected"
                      ? "対応なし"
                      : "確認済み"}
            </T>
            {r.resolution ? (
              <T color={C.muted} size={13}>
                {r.resolution}
              </T>
            ) : null}
            {!r.withdrawn && r.status === "pending" && (
              <LinkButton
                color={C.ink}
                label={
                  active === `withdraw:${r.id}` ? "取り下げ中…" : "取り下げる"
                }
                disabled={busy}
                onPress={() =>
                  ask(
                    k === "reports"
                      ? "通報を取り下げる？"
                      : "削除依頼を取り下げる？",
                    "運営への依頼を取り消します。",
                    () =>
                      runAction(`withdraw:${r.id}`, async () => {
                        if (!r.id) throw new Error("依頼が見つかりません");
                        await api.withdrawRequest(r.id);
                        await refresh();
                        toast("取り下げました");
                      }),
                    "取り下げる",
                  )
                }
              />
            )}
          </Panel>
        )),
      )}
      {isAdmin && (
        <Btn
          plain
          label="通報の対応（運営）"
          onPress={() => nav.push("moderation")}
        />
      )}
      {dialog}
    </Board>
  );
}
