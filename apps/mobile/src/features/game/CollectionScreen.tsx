import React from "react";
import {
  Board,
  BoardList,
  C,
  Header,
  Panel,
  StrengthCard,
  T,
} from "../../components/ui";
import { StaggerItem } from "../../components/motion";
import { useAppWidth } from "../../components/app-frame";
import { useApp } from "../../store";
import { usePullRefresh } from "../refresh/use-pull-refresh";

/** A phone shows two cards a row; a tablet's wider column fits three. */
const TABLET_COLUMNS_FROM_WIDTH = 520;

/** Every card in the deck, in the same order the deck grid uses. */
export function Collection() {
  const { d, nav } = useApp();
  const pull = usePullRefresh();
  const columns = useAppWidth() >= TABLET_COLUMNS_FROM_WIDTH ? 3 : 2;
  const blanks = (columns - (d.deck.length % columns)) % columns;
  return (
    <Board>
      <Header title={`強みカード ${d.deck.length}枚`} onBack={nav.pop} />
      <BoardList
        testID="collection-list"
        // A short last row keeps its cards as wide as the others with empty cells.
        data={[...d.deck, ...Array<null>(blanks).fill(null)]}
        keyExtractor={(card, index) => card?.key ?? `empty-${index}`}
        // FlatList cannot change numColumns on the fly; a new key remounts it.
        key={columns}
        numColumns={columns}
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
        renderItem={({ item, index }) => (
          // minWidth 0 lets a cell shrink below its card's content width on the web.
          <StaggerItem
            itemKey={`collection:${item?.key ?? `empty-${index}`}`}
            index={index}
            style={{ flex: 1, minWidth: 0, height: 220 }}
          >
            {item && (
              <StrengthCard
                card={item}
                style={{ flex: 1 }}
                onPress={() => nav.push("card", { key: item.key })}
              />
            )}
          </StaggerItem>
        )}
      />
    </Board>
  );
}
