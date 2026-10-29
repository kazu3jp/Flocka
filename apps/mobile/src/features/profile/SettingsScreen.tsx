import { useState } from "react";
import { Switch } from "react-native";
import {
  Avatar,
  Board,
  C,
  Header,
  InlineError,
  LinkButton,
  List,
  ListRow,
  Section,
} from "../../components/ui";
import { useConfirmation } from "../../components/pickers";
import { useApp } from "../../store";
import { SavedButNotRefreshedError } from "../sync/refresh-after-write";
import { useAction } from "../sync/use-action";
import { usePullRefresh } from "../refresh/use-pull-refresh";
import { useSettingsActions } from "./use-settings-actions";
import {
  RECEIVING_SWITCHES,
  canWithdrawRequest,
  requestStatusLabel,
} from "./settings-view-model";

type SettingsAction =
  `toggle:${string}` | `unblock:${string}` | `withdraw:${string}`;

/**
 * The source's s09-settings, with each part a titled list: what may reach
 * you, whom you blocked, and what you reported. A switch saves as it is
 * flipped and flips back if the save fails, so there is no unsaved state.
 */
export function Settings() {
  const { s, nav, toast, peers, isAdmin } = useApp(),
    actions = useSettingsActions(),
    { busy, error, run } = useAction(),
    { ask, dialog } = useConfirmation(),
    pull = usePullRefresh(),
    // The switch being saved shows its new position until the save settles.
    [pending, setPending] = useState<typeof s.settings | null>(null),
    [active, setActive] = useState<SettingsAction | null>(null);
  const settings = pending ?? s.settings;
  const runAction = (action: SettingsAction, task: () => Promise<void>) => {
    setActive(action);
    void run(task).finally(() => setActive(null));
  };
  const toggle = (key: keyof typeof s.settings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setPending(next);
    runAction(`toggle:${key}`, async () => {
      try {
        await actions.saveSettings(next);
        toast("設定を保存しました");
      } catch (failure) {
        // Saved, but not read back: the switch keeps its new position.
        if (!(failure instanceof SavedButNotRefreshedError)) setPending(null);
        throw failure;
      }
      setPending(null);
    });
  };
  const history = [
    ...s.reports.map((r) => ({ ...r, kind: "reports" as const })),
    ...s.deletions.map((r) => ({ ...r, kind: "deletions" as const })),
  ];
  return (
    <Board scroll refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      <Header title="公開範囲・安全" onBack={nav.pop} />
      <Section title="証言の公開範囲">
        <List testID="settings-visibility">
          <ListRow
            icon="lock"
            title="届いた証言は、はじめは本人だけ"
            caption="証言ごとに「本人だけ」「個別公開」「非表示」を選べます"
            onPress={() => nav.push("pieces")}
          />
          <ListRow
            icon="globe"
            title="個別公開した証言は、交換した人だけが見られる"
            caption="送った人の名前は表示されません"
          />
          <ListRow
            icon="eyeoff"
            title="非表示にした証言は、誰にも見えない"
            caption="デッキと自己PRにも使われません"
          />
          <ListRow
            icon="users"
            title="プロフィールとSNSは、交換した人にだけ"
            caption="一般には公開されません"
          />
        </List>
      </Section>
      <Section
        title="受け取る証言"
        lead="切り替えるとすぐ保存され、今後届く封筒に適用します。"
        testID="settings-receiving"
      >
        <List>
          {RECEIVING_SWITCHES.map(({ key, label, hint }) => (
            <ListRow
              key={key}
              title={label}
              caption={hint}
              trailing={
                <Switch
                  accessibilityLabel={label}
                  accessibilityHint={hint}
                  value={settings[key]}
                  disabled={busy}
                  onValueChange={(value) => toggle(key, value)}
                  trackColor={{ true: C.blue, false: C.grey }}
                />
              }
            />
          ))}
        </List>
        <InlineError text={error} />
      </Section>
      <Section
        title="ブロック中"
        lead="ブロックした人の証言は、デッキ・自己PR・交換一覧から外れます。"
      >
        {s.blocked.length === 0 ? (
          <List>
            <ListRow icon="ban" title="ブロック中の人はいません" />
          </List>
        ) : (
          <List testID="settings-blocked">
            {s.blocked.map((id) => {
              // Never show a raw account id when the profile is unavailable.
              const name = peers[id]?.profile.name || "名前を取得できない相手";
              return (
                <ListRow
                  key={id}
                  leading={
                    <Avatar
                      name={peers[id]?.profile.name ?? ""}
                      avatar={peers[id]?.profile.avatar}
                      size={30}
                    />
                  }
                  title={name}
                  trailing={
                    <LinkButton
                      color={C.ink}
                      label={active === `unblock:${id}` ? "解除中…" : "解除"}
                      accessibilityLabel={`${name}のブロックを解除`}
                      disabled={busy}
                      onPress={() =>
                        ask(
                          "ブロックを解除する？",
                          `${name}の証言が、デッキ・自己PR・交換一覧に戻ります。`,
                          () =>
                            runAction(`unblock:${id}`, async () => {
                              await actions.unblock(id);
                              toast("ブロックを解除しました");
                            }),
                          "解除する",
                        )
                      }
                    />
                  }
                />
              );
            })}
          </List>
        )}
      </Section>
      <Section title="通報・削除依頼">
        {history.length === 0 ? (
          <List>
            <ListRow icon="flag" title="通報・削除依頼の履歴はありません" />
          </List>
        ) : (
          <List testID="settings-requests">
            {history.map((entry) => (
              <ListRow
                key={entry.id ?? entry.kind + entry.at}
                title={`${entry.kind === "reports" ? "通報" : "削除依頼"}${entry.reason ? `：${entry.reason}` : ""}`}
                caption={[requestStatusLabel(entry), entry.resolution]
                  .filter(Boolean)
                  .join("・")}
                trailing={
                  canWithdrawRequest(entry) ? (
                    <LinkButton
                      color={C.ink}
                      label={
                        active === `withdraw:${entry.id}`
                          ? "取り下げ中…"
                          : "取り下げる"
                      }
                      disabled={busy}
                      onPress={() =>
                        ask(
                          entry.kind === "reports"
                            ? "通報を取り下げる？"
                            : "削除依頼を取り下げる？",
                          "運営への依頼を取り消します。",
                          () =>
                            runAction(`withdraw:${entry.id}`, async () => {
                              await actions.withdraw(entry.id);
                              toast("取り下げました");
                            }),
                          "取り下げる",
                        )
                      }
                    />
                  ) : null
                }
              />
            ))}
          </List>
        )}
      </Section>
      {isAdmin && (
        <List>
          <ListRow
            icon="flag"
            title="通報の対応（運営）"
            onPress={() => nav.push("moderation")}
          />
        </List>
      )}
      {dialog}
    </Board>
  );
}
