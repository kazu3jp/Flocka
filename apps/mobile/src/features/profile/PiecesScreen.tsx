import { Pressable, View } from "react-native";

import {
  Board,
  BoardList,
  C,
  Envelope,
  Header,
  Icon,
  Panel,
  S,
  T,
} from "../../components/ui";
import { wordsOf } from "@flocka/domain";
import { useApp } from "../../store";
import { usePullRefresh } from "../refresh/use-pull-refresh";

export function Pieces() {
  const { d, nav, setOpening, peers } = useApp();
  const pull = usePullRefresh();
  return (
    <Board>
      <Header title="届いた証言" onBack={nav.pop} />
      <BoardList
        testID="pieces-list"
        data={[...d.pieces].reverse()}
        keyExtractor={(p) => p.id}
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
        ListEmptyComponent={
          <Panel>
            <T color={C.ink}>
              まだ届いていません。交換した仲間から印象やメモが届くと、ここに並びます。
            </T>
          </Panel>
        }
        renderItem={({ item: p }) => {
          const name = peers[p.fromId]?.profile.name ?? "プロフィールを取得中";
          const summary = p.opened
            ? wordsOf(p)
            : "どのカードの証言か予想しよう";
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${name}より・${p.opened ? "開封済み" : "未開封"}・${summary}`}
              accessibilityHint={
                p.opened ? "証言の詳細を開きます" : "封筒を開けて予想します"
              }
              onPress={() =>
                p.opened ? nav.push("piece", { id: p.id }) : setOpening(p.id)
              }
            >
              <Panel style={S.row}>
                {p.opened ? <Icon name="doc" color={C.ink} /> : <Envelope />}
                <View style={S.fill}>
                  <T color={C.ink}>
                    {name}より · {p.opened ? "開封済み" : "未開封"}
                  </T>
                  <T color={C.muted} size={13}>
                    {summary}
                  </T>
                </View>
                <Icon name="chev" color={C.ink} />
              </Panel>
            </Pressable>
          );
        }}
      />
    </Board>
  );
}
