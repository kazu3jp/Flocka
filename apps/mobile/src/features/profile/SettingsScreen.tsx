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
} from "../../components/ui";
import { PEOPLE } from "@flocka/domain";
import { useApp } from "../../store";

export function Settings() {
  const { s, update, nav, toast } = useApp(),
    [settings, setSettings] = useState(s.settings),
    { ask, dialog } = useConfirmation();
  return (
    <Board scroll>
      <Header title="公開範囲・安全" onBack={nav.pop} />
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
        onPress={() =>
          ask(
            "受け取り設定を変更する？",
            "変更は今後届く封筒に適用します。",
            () => {
              update((x) => {
                x.settings = settings;
              });
              toast("設定を保存しました");
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
            label={`${PEOPLE[id]?.name || id}のブロックを解除`}
            onPress={() => {
              update((x) => {
                x.blocked = x.blocked.filter((v) => v !== id);
              });
              toast("ブロックを解除しました");
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
        s[k].map((r, i) => (
          <Panel key={k + r.at}>
            <T color={C.ink} size={13}>
              {k === "reports" ? "通報" : "削除依頼"} · {r.reason || "削除依頼"}{" "}
              · {r.withdrawn ? "取り下げ済み" : "端末内記録"}
            </T>
            {!r.withdrawn && (
              <LinkButton
                color={C.ink}
                label="取り下げる"
                onPress={() => {
                  update((x) => {
                    x[k][i].withdrawn = true;
                  });
                  toast("取り下げました");
                }}
              />
            )}
          </Panel>
        )),
      )}
      <T size={13} color={C.pale}>
        この移植版はデザインの操作用デモです。近距離通信・相手への送信・公開・運営への送信には接続していません。プロフィールと写真は端末内に保存されます。
      </T>
      {dialog}
    </Board>
  );
}
