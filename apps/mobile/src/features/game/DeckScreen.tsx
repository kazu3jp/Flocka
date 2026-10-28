import React, { useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Avatar,
  Board,
  Btn,
  C,
  Envelope,
  F,
  Icon,
  LinkButton,
  LockedCard,
  Panel,
  S,
  Sheet,
  StrengthCard,
  T,
  OUTLINE,
} from "../../components/ui";

import {
  ProgressFill,
  SquishPressable,
  StaggerItem,
} from "../../components/motion";
import { useApp } from "../../store";
import { usePullRefresh } from "../refresh/use-pull-refresh";
import { TOUR_TARGETS } from "../guided-tour/tour-steps";
import { useTourTarget } from "../guided-tour/use-tour-target";

const DECK_SLOTS = 6;

/** The last grid slot opens the full collection once the deck outgrows the grid. */
function MoreCardsTile({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  return (
    <SquishPressable
      testID="deck-more"
      pressScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={`ほか${count}枚のカードをすべて見る`}
      onPress={onPress}
      style={S.fill}
    >
      <Panel
        style={{
          flex: 1,
          padding: 10,
          borderRadius: 14,
          boxShadow: OUTLINE.shadow,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <T display size={26} color={C.ink} style={{ lineHeight: 32 }}>
          +{count}枚
        </T>
        <View style={[S.row, { gap: 2 }]}>
          <T size={13} color={C.ink} style={{ fontFamily: F.bold }}>
            すべて見る
          </T>
          <Icon name="chev" size={16} color={C.ink} />
        </View>
      </Panel>
    </SquishPressable>
  );
}

/** Smallest row height the deck grid shares out, and the height each row keeps once it scrolls. */
const DECK_ROW_MIN_HEIGHT = 100;
const DECK_SCROLLING_ROW_HEIGHT = 150;
const DECK_GRID_GAP = 10;
/**
 * Smallest illustration a shared row may leave a card. The source design
 * itself leaves little more than this on short screens; enlarged text
 * squeezes it further, and the system font scale is not always visible to
 * the app, so the deck measures what is left. A card hides its No. label
 * when the illustration is too short for it.
 */
const DECK_CARD_MIN_ART_HEIGHT = 22;
const DECK_ROUNDING_SLACK = 2;

function BannerCaption({ children }: { children: React.ReactNode }) {
  // The source's .quest .cap / .prbar .cap: a block line of 11.5px at 1.45.
  return (
    <T size={11.5} color={C.ink} balanced style={{ lineHeight: 16.675 }}>
      {children}
    </T>
  );
}

export function Deck() {
  const { s, d, nav, setOpening } = useApp(),
    { height, fontScale } = useWindowDimensions(),
    pull = usePullRefresh(),
    [lockedHint, setLockedHint] = useState(false),
    [gridHeight, setGridHeight] = useState(0),
    [cardTextHeight, setCardTextHeight] = useState(0),
    measured = useRef({ row: 0, art: Infinity, pending: false }),
    firstRowTarget = useTourTarget(TOUR_TARGETS.deckCards),
    questTarget = useTourTarget(TOUR_TARGETS.deckQuest),
    giveTarget = useTourTarget(TOUR_TARGETS.deckGive),
    meTarget = useTourTarget(TOUR_TARGETS.deckMe);
  const overflow = d.deck.length > DECK_SLOTS;
  // With more cards than slots, the last slot links to the full collection.
  const shown = overflow ? d.deck.slice(0, DECK_SLOTS - 1) : d.deck;
  const hidden = d.deck.length - shown.length;
  const slots: ((typeof d.deck)[number] | "more" | null)[] = [
    ...shown,
    ...(overflow ? ["more" as const] : []),
    ...Array(Math.max(0, DECK_SLOTS - d.deck.length)).fill(null),
  ];
  // People the user chose to write to later are not recommended again here.
  const unsent = s.connections.filter(
    (c) =>
      c.status === "accepted" &&
      !c.vibe &&
      !c.later &&
      !s.blocked.includes(c.peerId),
  );
  const challenge = !!d.unopened.length,
    quest = challenge || !!unsent.length || !d.pieces.length;
  const goQuest = () =>
    challenge
      ? setOpening(d.unopened[0].id)
      : unsent.length
        ? nav.goTab("exchange", { id: "connections" })
        : nav.goTab("exchange");
  const largeText = fontScale > 1.2;
  // The rows share the height left on the screen. When that is less than
  // three readable rows (a short phone, or a font the screen cannot tell is
  // enlarged), the rows keep their height and the grid scrolls.
  // A card's text takes the same height whatever the row height (the
  // illustration gets the rest), so the rows the grid needs follow from it,
  // and the decision does not flip when scrolling changes the row height.
  const rowNeed = Math.max(
    DECK_ROW_MIN_HEIGHT,
    cardTextHeight > 0 ? cardTextHeight + DECK_CARD_MIN_ART_HEIGHT : 0,
  );
  // Measured heights carry rounding; a pixel or two short is not a squeeze.
  const scrollGrid =
    largeText ||
    (gridHeight > 0 &&
      gridHeight + DECK_ROUNDING_SLACK < 3 * rowNeed + 2 * DECK_GRID_GAP);
  const scrollingRowHeight = Math.max(
    largeText ? 200 : DECK_SCROLLING_ROW_HEIGHT,
    rowNeed,
  );
  // The illustration reports before its row does, so pair the two only once
  // the whole layout pass has reported (on the next frame).
  const reviewRows = () => {
    if (measured.current.pending) return;
    measured.current.pending = true;
    requestAnimationFrame(() => {
      const current = measured.current;
      current.pending = false;
      if (current.row <= 0 || !Number.isFinite(current.art)) return;
      const text = current.row - current.art;
      setCardTextHeight((previous) =>
        Math.abs(text - previous) > 1 ? text : previous,
      );
    });
  };
  const measureArt = (artHeight: number) => {
    measured.current.art = artHeight;
    reviewRows();
  };
  const compact = height <= 720;
  const grid = (
    <View style={{ flex: scrollGrid ? undefined : 1, gap: DECK_GRID_GAP }}>
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          {...(row === 0 ? firstRowTarget : {})}
          testID={row === 0 ? "deck-first-row" : undefined}
          onLayout={
            row === 0
              ? ({ nativeEvent: { layout } }) => {
                  measured.current.row = layout.height;
                  reviewRows();
                }
              : undefined
          }
          style={{
            flex: scrollGrid ? undefined : 1,
            height: scrollGrid ? scrollingRowHeight : undefined,
            flexDirection: "row",
            gap: DECK_GRID_GAP,
          }}
        >
          {slots.slice(row * 2, row * 2 + 2).map((c, i) => {
            const slot = row * 2 + i;
            return (
              <StaggerItem
                key={c === "more" ? "more" : (c?.key ?? `locked-${i}`)}
                itemKey={`deck:${c === "more" ? "more" : (c?.key ?? `locked-${slot}`)}`}
                index={slot}
                style={S.fill}
              >
                {c === "more" ? (
                  <MoreCardsTile
                    count={hidden}
                    onPress={() => nav.push("collection")}
                  />
                ) : c ? (
                  <StrengthCard
                    card={c}
                    style={S.fill}
                    onArtHeight={measureArt}
                    onPress={() => nav.push("card", { key: c.key })}
                  />
                ) : (
                  <SquishPressable
                    pressScale={0.97}
                    accessibilityRole="button"
                    accessibilityLabel="未発見のカード・見つけ方を見る"
                    onPress={() => setLockedHint(true)}
                    style={S.fill}
                  >
                    <LockedCard style={S.fill} />
                  </SquishPressable>
                )}
              </StaggerItem>
            );
          })}
        </View>
      ))}
    </View>
  );
  return (
    <Board>
      <View
        testID="deck-header"
        style={[S.row, { minHeight: compact ? 44 : 48 }]}
      >
        <Pressable
          {...meTarget}
          accessibilityLabel="自分のページ"
          accessibilityRole="button"
          onPress={() => nav.push("me")}
          style={{
            width: 44,
            height: 44,
            marginLeft: -6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Avatar name={s.profile.name} avatar={s.profile.avatar} size={40} />
        </Pressable>
        <View style={S.fill}>
          <T display size={19} style={{ lineHeight: 22.8 }}>
            {s.profile.name}
          </T>
          <T
            size={12}
            color={C.pale}
            style={{ fontFamily: F.bold, lineHeight: 15.6 }}
          >
            強みカード {d.deck.length}枚
          </T>
        </View>
        <View {...giveTarget}>
          <LinkButton
            label="印象を贈る"
            onPress={() =>
              nav.goTab(
                "exchange",
                s.connections.some(
                  (c) =>
                    c.status === "accepted" && !s.blocked.includes(c.peerId),
                )
                  ? { id: "connections" }
                  : undefined,
              )
            }
          />
        </View>
      </View>
      {quest && (
        <SquishPressable
          {...questTarget}
          testID="deck-challenge"
          pressScale={0.98}
          accessibilityRole="button"
          accessibilityLabel={
            challenge
              ? "予想チャレンジ！"
              : unsent.length
                ? "交換した人に印象を贈ろう"
                : "まずは交換しよう"
          }
          onPress={goQuest}
        >
          <Panel
            style={[
              S.row,
              {
                paddingVertical: 8,
                paddingHorizontal: 10,
                gap: 10,
                backgroundColor: C.yellow,
              },
            ]}
          >
            <View style={{ width: 42, height: 32 }}>
              {(challenge ? d.unopened.slice(0, 3) : [null]).map(
                (piece, index) => (
                  <View
                    key={piece?.id ?? "exchange"}
                    style={{
                      position: "absolute",
                      left: challenge ? index * 5 : 4,
                      top: challenge ? index * 3 : 4,
                      transform: [
                        { rotate: `${challenge ? (index - 1) * 8 : 0}deg` },
                      ],
                    }}
                  >
                    <Envelope size={34} />
                  </View>
                ),
              )}
            </View>
            <View style={S.fill}>
              <T
                display
                balanced
                size={15}
                color={C.ink}
                style={{ lineHeight: 18.75 }}
              >
                {challenge
                  ? "予想チャレンジ！"
                  : unsent.length
                    ? "交換した人に印象を贈ろう"
                    : "まずは交換しよう"}
              </T>
              <BannerCaption>
                {challenge
                  ? `封筒${d.unopened.length}通・どのカードか当てよう`
                  : unsent.length
                    ? `まだ印象を贈っていない人が${unsent.length}人います`
                    : "会った人と、カードを交換"}
              </BannerCaption>
            </View>
            <T
              display
              size={13}
              color={C.yellow}
              style={{
                backgroundColor: C.ink,
                borderRadius: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                lineHeight: 13,
              }}
            >
              {challenge ? "開ける" : unsent.length ? "贈る" : "交換"}
            </T>
          </Panel>
        </SquishPressable>
      )}
      <View
        style={{ flex: 1, minHeight: 0 }}
        onLayout={({ nativeEvent: { layout } }) => {
          setGridHeight(layout.height);
        }}
      >
        {scrollGrid ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 4 }}
            style={S.fill}
            refreshControl={
              <RefreshControl
                refreshing={pull.refreshing}
                onRefresh={pull.onRefresh}
                tintColor={C.yellow}
                colors={[C.ink]}
                progressBackgroundColor={C.yellow}
              />
            }
          >
            {grid}
          </ScrollView>
        ) : (
          grid
        )}
      </View>
      <SquishPressable
        testID="deck-pr"
        pressScale={0.98}
        accessibilityRole="button"
        accessibilityLabel={
          d.prCard ? "自己PRが書けます！" : `自己PR あと証言${2 - d.best}人`
        }
        onPress={() => nav.goTab("pr")}
      >
        <Panel
          style={[
            S.row,
            {
              paddingVertical: 8,
              paddingHorizontal: 10,
              gap: 10,
              backgroundColor: d.prCard ? C.paper : C.ink,
              boxShadow: d.prCard ? `4px 4px 0 ${C.ink}` : "none",
            },
          ]}
        >
          <View
            style={{
              width: 32,
              height: 38,
              backgroundColor: d.prCard ? C.yellow : C.paper,
              borderWidth: OUTLINE.width,
              borderColor: C.ink,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T display color={C.ink} size={13} style={{ lineHeight: 13 }}>
              PR
            </T>
          </View>
          <View style={S.fill}>
            <T
              display
              size={14}
              color={d.prCard ? C.ink : C.white}
              style={{ lineHeight: 18.2 }}
            >
              {d.prCard
                ? "自己PRが書けます！"
                : `自己PR　あと証言${2 - d.best}人`}
            </T>
            {d.prCard ? (
              <BannerCaption>「{d.prCard.name}」から下書きを生成</BannerCaption>
            ) : (
              <View style={[S.row, { gap: 4, marginTop: 3 }]}>
                {[0, 1].map((i) => (
                  <ProgressFill
                    key={i}
                    filled={i < d.best}
                    fillColor={C.yellow}
                    trackColor="rgba(255,255,255,0.2)"
                    style={{ width: 22, height: 6, borderRadius: 3 }}
                  />
                ))}
              </View>
            )}
          </View>
          <Icon name="chev" color={d.prCard ? C.ink : C.white} />
        </Panel>
      </SquishPressable>
      {lockedHint && (
        <Sheet title="未発見のカード" onClose={() => setLockedHint(false)}>
          <T>
            仲間の証言で新しいカードが見つかります。交換した人から印象やメモが届くと、封筒を開けたときにカードが加わります。
          </T>
          <Btn
            label="交換する"
            onPress={() => {
              setLockedHint(false);
              nav.goTab("exchange");
            }}
          />
          <Btn plain label="閉じる" onPress={() => setLockedHint(false)} />
        </Sheet>
      )}
    </Board>
  );
}
