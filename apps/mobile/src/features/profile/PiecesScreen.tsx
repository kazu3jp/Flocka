import { Pressable, View } from "react-native";

import {
  Board,
  C,
  Envelope,
  Header,
  Icon,
  Panel,
  S,
  T,
} from "../../components/ui";
import { PEOPLE, wordsOf } from "@flocka/domain";
import { useApp } from "../../store";

export function Pieces() {
  const { d, nav, setOpening } = useApp();
  return (
    <Board scroll>
      <Header title="届いた証言" onBack={nav.pop} />
      {!d.pieces.length ? (
        <Panel>
          <T color={C.ink}>
            まだ届いていません。交換した仲間から印象やメモが届くと、ここに並びます。
          </T>
        </Panel>
      ) : (
        [...d.pieces].reverse().map((p) => (
          <Pressable
            accessibilityRole="button"
            key={p.id}
            onPress={() =>
              p.opened ? nav.push("piece", { id: p.id }) : setOpening(p.id)
            }
          >
            <Panel style={S.row}>
              {p.opened ? <Icon name="doc" color={C.ink} /> : <Envelope />}
              <View style={S.fill}>
                <T color={C.ink}>
                  {PEOPLE[p.fromId].name}より ·{" "}
                  {p.opened ? "開封済み" : "未開封"}
                </T>
                <T color={C.muted} size={13}>
                  {p.opened ? wordsOf(p) : "どのカードの証言か予想しよう"}
                </T>
              </View>
              <Icon name="chev" color={C.ink} />
            </Panel>
          </Pressable>
        ))
      )}
    </Board>
  );
}
