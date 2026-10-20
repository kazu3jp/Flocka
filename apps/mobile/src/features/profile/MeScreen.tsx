import { AccountPanel } from "../auth/AccountPanel";
import { BackupPanel } from "../sync/BackupPanel";
import { View } from "react-native";

import {
  Avatar,
  Board,
  Btn,
  C,
  Header,
  Panel,
  S,
  T,
} from "../../components/ui";
import { useApp } from "../../store";
import { usePullRefresh } from "../refresh/use-pull-refresh";

export function Me() {
  const { s, nav, d } = useApp();
  const pull = usePullRefresh();
  return (
    <Board scroll refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      <Header title="自分" onBack={nav.pop} />
      <Panel>
        <View style={S.row}>
          <Avatar name={s.profile.name} avatar={s.profile.avatar} size={64} />
          <View style={S.fill}>
            <T display color={C.ink} size={22}>
              {s.profile.name}
            </T>
            <T color={C.muted} size={13}>
              {s.profile.role}
            </T>
          </View>
        </View>
      </Panel>
      {[
        ["avatar", "アイコン", "edit"],
        ["selfEdit", "プロフィールと自己申告カード", "deck"],
        ["pieces", `届いた証言（${d.pieces.length}）`, "list"],
        ["settings", "公開範囲・安全", "shield"],
      ].map(([id, label, icon]) => (
        <Btn
          key={id}
          plain
          label={label}
          icon={icon}
          onPress={() =>
            nav.push(id as "avatar" | "selfEdit" | "pieces" | "settings")
          }
        />
      ))}
      <BackupPanel />
      <AccountPanel />
    </Board>
  );
}
