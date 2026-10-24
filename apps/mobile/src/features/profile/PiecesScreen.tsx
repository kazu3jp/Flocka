import { useState } from "react";
import { View } from "react-native";

import {
  Board,
  BoardList,
  C,
  Envelope,
  Header,
  Icon,
  LinkButton,
  Panel,
  S,
  T,
} from "../../components/ui";
import { allPieces, wordsOf, type State } from "@flocka/domain";
import { SquishPressable, StaggerItem } from "../../components/motion";
import { useApp } from "../../store";
import { usePullRefresh } from "../refresh/use-pull-refresh";

/** Hidden testimonies leave the deck, but stay reachable so they can be shown again. */
function hiddenPieces(s: State) {
  return allPieces(s)
    .filter((p) => p.visibility === "hidden" && !s.blocked.includes(p.fromId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function Pieces() {
  const { s, d, nav, setOpening, peers } = useApp();
  const pull = usePullRefresh();
  const [showHidden, setShowHidden] = useState(false);
  const hidden = hiddenPieces(s);
  const hiddenSection = hidden.length ? (
    <View testID="pieces-hidden" style={{ gap: 12 }}>
      <LinkButton
        label={`非表示の証言（${hidden.length}件）を${showHidden ? "閉じる" : "見る"}`}
        onPress={() => setShowHidden((shown) => !shown)}
      />
      {showHidden &&
        hidden.map((p) => {
          const name = peers[p.fromId]?.profile.name ?? "プロフィールを取得中";
          return (
            <SquishPressable
              key={p.id}
              pressScale={0.98}
              accessibilityRole="button"
              accessibilityLabel={`${name}より・非表示・${p.opened ? wordsOf(p) : "未開封"}`}
              accessibilityHint="公開範囲を変更できます"
              onPress={() => nav.push("piece", { id: p.id })}
            >
              <Panel style={S.row}>
                <Icon name="eyeoff" color={C.ink} />
                <View style={S.fill}>
                  <T color={C.ink}>{name}より · 非表示</T>
                  <T color={C.muted} size={13}>
                    {p.opened ? wordsOf(p) : "未開封"}
                  </T>
                </View>
                <Icon name="chev" color={C.ink} />
              </Panel>
            </SquishPressable>
          );
        })}
    </View>
  ) : null;
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
        ListFooterComponent={hiddenSection}
        renderItem={({ item: p, index }) => {
          const name = peers[p.fromId]?.profile.name ?? "プロフィールを取得中";
          const summary = p.opened
            ? wordsOf(p)
            : "どのカードの証言か予想しよう";
          return (
            <StaggerItem itemKey={`piece:${p.id}`} index={index}>
              <SquishPressable
                pressScale={0.98}
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
              </SquishPressable>
            </StaggerItem>
          );
        }}
      />
    </Board>
  );
}
