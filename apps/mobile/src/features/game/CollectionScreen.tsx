import React from "react";
import { View } from "react-native";
import {
  Board,
  BoardList,
  C,
  Header,
  Panel,
  StrengthCard,
  T,
} from "../../components/ui";
import { useApp } from "../../store";
import { usePullRefresh } from "../refresh/use-pull-refresh";

/** Every card in the deck, in the same order the deck grid uses. */
export function Collection() {
  const { d, nav } = useApp();
  const pull = usePullRefresh();
  return (
    <Board>
      <Header title={`強みカード ${d.deck.length}枚`} onBack={nav.pop} />
      <BoardList
        testID="collection-list"
        // An odd last row keeps half-width cards with an empty partner cell.
        data={d.deck.length % 2 ? [...d.deck, null] : d.deck}
        keyExtractor={(card) => card?.key ?? "empty"}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        refreshing={pull.refreshing}
        onRefresh={pull.onRefresh}
        ListEmptyComponent={
          <Panel>
            <T color={C.ink}>
              まだカードがありません。仲間の証言で新しいカードが見つかります。
            </T>
          </Panel>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, height: 220 }}>
            {item && (
              <StrengthCard
                card={item}
                style={{ flex: 1 }}
                onPress={() => nav.push("card", { key: item.key })}
              />
            )}
          </View>
        )}
      />
    </Board>
  );
}
