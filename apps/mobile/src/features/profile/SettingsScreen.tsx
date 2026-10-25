import { AccountPanel } from "../auth/AccountPanel";
import { NotificationPanel } from "../notifications/NotificationPanel";
import { LegalDocument } from "../auth/LegalDocument";
import type { LegalTitle } from "@flocka/domain";
import { useTour } from "../guided-tour/tour-context";
import { useAction } from "../sync/use-action";
import { useState } from "react";
import {
  Board,
  Btn,
  Header,
  InlineError,
  Panel,
  Sheet,
} from "../../components/ui";
import { useConfirmation } from "../../components/pickers";
import { useApp, useAppStatus } from "../../store";
import { usePullRefresh } from "../refresh/use-pull-refresh";
import { BlockedPeopleList, type BlockedPerson } from "./BlockedPeopleList";
import { RequestHistoryList, type HistoryEntry } from "./RequestHistoryList";
import { SettingToggleRow } from "./SettingToggleRow";
import { SettingsSection } from "./SettingsSection";
import { VisibilitySummary } from "./VisibilitySummary";
import {
  RECEIVING_SWITCHES,
  describeVisibility,
  hasUnsavedSettings,
} from "./settings-view-model";

type SettingsAction =
  "sync" | "save" | `unblock:${string}` | `withdraw:${string}`;

export function Settings() {
  const { s, api, refresh, nav, toast, peers, isAdmin } = useApp(),
    { syncing } = useAppStatus(),
    tour = useTour(),
    [legal, setLegal] = useState<LegalTitle | null>(null),
    // Unsaved edits only; otherwise the switches follow the latest server settings.
    [draft, setDraft] = useState<typeof s.settings | null>(null),
    { busy, error, run } = useAction(),
    { ask, dialog } = useConfirmation(),
    pull = usePullRefresh(),
    // Which action is running, so only its button shows progress.
    [active, setActive] = useState<SettingsAction | null>(null);
  const settings = draft ?? s.settings;
  const changed = hasUnsavedSettings(s.settings, settings);
  const runAction = (action: SettingsAction, task: () => Promise<void>) => {
    setActive(action);
    void run(task).finally(() => setActive(null));
  };
  const blocked: BlockedPerson[] = s.blocked.map((id) => ({
    id,
    // Never show a raw account id when the profile is unavailable.
    name: peers[id]?.profile.name || "名前を取得できない相手",
  }));
  const history: HistoryEntry[] = [
    ...s.reports.map((r) => ({ ...r, kind: "reports" as const })),
    ...s.deletions.map((r) => ({ ...r, kind: "deletions" as const })),
  ];
  const activeWithId = (prefix: "unblock" | "withdraw") =>
    active?.startsWith(`${prefix}:`) ? active.slice(prefix.length + 1) : null;
  return (
    <Board scroll refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      <Header title="公開範囲・安全" onBack={nav.pop} />

      <SettingsSection
        title="いまの公開範囲"
        lead="保存済みの設定で、誰に何が見えるかのまとめです。"
      >
        <VisibilitySummary
          lines={describeVisibility({
            settings: s.settings,
            snsLinkCount: s.profile.snsLinks.length,
            blockedCount: s.blocked.length,
          })}
        />
      </SettingsSection>

      <SettingsSection
        title="受け取り設定"
        lead="変更は今後届く封筒に適用します。保存するまで反映されません。"
      >
        <Panel style={{ paddingVertical: 4 }}>
          {RECEIVING_SWITCHES.map(({ key, label, hint }, index) => (
            <SettingToggleRow
              key={key}
              label={label}
              hint={hint}
              value={settings[key]}
              first={index === 0}
              onChange={(v) => setDraft({ ...settings, [key]: v })}
            />
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
        <InlineError text={error} reserveLines={2} />
      </SettingsSection>

      <SettingsSection
        title="ブロックと報告"
        lead="ブロックした人の証言は、デッキ・自己PR・交換一覧から外れます。"
      >
        <BlockedPeopleList
          people={blocked}
          busy={busy}
          activeId={activeWithId("unblock")}
          onUnblock={(person) =>
            ask(
              "ブロックを解除する？",
              `${person.name}の証言が、デッキ・自己PR・交換一覧に戻ります。`,
              () =>
                runAction(`unblock:${person.id}`, async () => {
                  await api.unblock(person.id);
                  await refresh();
                  toast("ブロックを解除しました");
                }),
              "解除する",
            )
          }
        />
        <RequestHistoryList
          entries={history}
          busy={busy}
          activeId={activeWithId("withdraw")}
          onWithdraw={(entry) =>
            ask(
              entry.kind === "reports"
                ? "通報を取り下げる？"
                : "削除依頼を取り下げる？",
              "運営への依頼を取り消します。",
              () =>
                runAction(`withdraw:${entry.id}`, async () => {
                  if (!entry.id) throw new Error("依頼が見つかりません");
                  await api.withdrawRequest(entry.id);
                  await refresh();
                  toast("取り下げました");
                }),
              "取り下げる",
            )
          }
        />
        {isAdmin && (
          <Btn
            plain
            label="通報の対応（運営）"
            onPress={() => nav.push("moderation")}
          />
        )}
      </SettingsSection>

      <SettingsSection title="通知">
        <NotificationPanel />
      </SettingsSection>

      <SettingsSection
        title="データ"
        lead="他の端末での変更や、運営の対応結果を読み込み直します。"
      >
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
      </SettingsSection>

      <SettingsSection title="使い方・規約">
        <Btn plain small label="使い方をもう一度見る" onPress={tour.start} />
        <Btn
          plain
          small
          label="利用規約"
          onPress={() => setLegal("利用規約")}
        />
        <Btn
          plain
          small
          label="プライバシーポリシー"
          onPress={() => setLegal("プライバシーポリシー")}
        />
      </SettingsSection>

      <SettingsSection title="アカウント">
        <AccountPanel />
      </SettingsSection>

      {legal && (
        <Sheet title={legal} onClose={() => setLegal(null)}>
          <LegalDocument title={legal} />
        </Sheet>
      )}
      {dialog}
    </Board>
  );
}
