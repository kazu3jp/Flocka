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

export function Settings() {
  const { s, api, refresh, nav, toast, peers, isAdmin } = useApp(),
    { syncing } = useAppStatus(),
    [legal, setLegal] = useState<LegalTitle | null>(null),
    [settings, setSettings] = useState(s.settings),
    { busy, error, run } = useAction(),
    { ask, dialog } = useConfirmation();
  return (
    <Board scroll>
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
        disabled={syncing || busy}
        onPress={() =>
          void run(async () => {
            await refresh();
            toast("サーバーと同期しました");
          })
        }
      />
      {error && <T color={C.yellow}>{error}</T>}
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
              onValueChange={(v) => setSettings({ ...settings, [k]: v })}
              trackColor={{ true: C.blue, false: C.grey }}
            />
          </View>
        ))}
      </Panel>
      <Btn
        label="設定を保存"
        disabled={busy}
        onPress={() =>
          ask(
            "受け取り設定を変更する？",
            "変更は今後届く封筒に適用します。",
            () => {
              void run(async () => {
                await api.saveSettings(settings);
                await refresh();
                toast("設定を保存しました");
              });
            },
            "保存する",
          )
        }
      />
      <T display size={18}>
        ブロック中
      </T>
      {s.blocked.length ? (
        s.blocked.map((id) => (
          <Btn
            key={id}
            plain
            label={`${peers[id]?.profile.name || id}のブロックを解除`}
            onPress={() => {
              void run(async () => {
                await api.unblock(id);
                await refresh();
                toast("ブロックを解除しました");
              });
            }}
          />
        ))
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
            {r.resolution && (
              <T color={C.muted} size={13}>
                {r.resolution}
              </T>
            )}
            {!r.withdrawn && r.status === "pending" && (
              <LinkButton
                color={C.ink}
                label="取り下げる"
                onPress={() => {
                  void run(async () => {
                    if (!r.id) throw new Error("依頼が見つかりません");
                    await api.withdrawRequest(r.id);
                    await refresh();
                    toast("取り下げました");
                  });
                }}
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
