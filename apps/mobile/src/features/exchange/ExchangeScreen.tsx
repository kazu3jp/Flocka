import React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import {
  Board,
  Btn,
  FIXED_LOOKING_BOARD,
  Header,
  Icon,
  LAYOUT,
} from "../../components/ui";
import {
  DISPLAY_FONT_MAX_MULTIPLIER,
  appliedFontScale,
} from "../../components/responsive-scale";
import { useFontScale } from "../../components/use-font-scale";

import { useApp } from "../../store";
import { Player } from "./player-card";
import { ShowcasePicker } from "./showcase-picker";
import { useShowcase } from "./use-showcase";
import { TOUR_TARGETS } from "../guided-tour/tour-steps";
import { useTourTarget } from "../guided-tour/use-tour-target";

/** Narrowest a button of the exchange row may be at the normal font size. */
const ACTION_LABEL_WIDTH = 132;
const ACTION_GAP = 10;

/**
 * The two exchange buttons sit side by side while each can hold its label on
 * one line, and one under the other once an enlarged font leaves them too
 * narrow for that.
 */
function useActionsStacked() {
  const { width } = useWindowDimensions();
  const eachWidth = (width - 2 * LAYOUT.screenPadding - ACTION_GAP) / 2;
  const labelWidth =
    ACTION_LABEL_WIDTH *
    appliedFontScale(useFontScale(), DISPLAY_FONT_MAX_MULTIPLIER);
  return eachWidth < labelWidth;
}

export function Exchange() {
  const { s, d, nav } = useApp();
  const showcase = useShowcase();
  const actionsTarget = useTourTarget(TOUR_TARGETS.exchangeActions);
  const stacked = useActionsStacked();
  return (
    <Board scroll contentStyle={FIXED_LOOKING_BOARD}>
      <Header
        title="交換"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="つながった人"
            onPress={() => nav.push("connections")}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="users" />
          </Pressable>
        }
      />
      <Player onPick={showcase.show} />
      <View
        {...actionsTarget}
        testID="exchange-actions"
        style={{ flexDirection: stacked ? "column" : "row", gap: ACTION_GAP }}
      >
        <Btn
          label="近くの人と交換"
          icon="swap"
          iconSize={20}
          iconStyle={{ flexShrink: 0 }}
          style={{
            ...(!stacked && { flex: 1 }),
            paddingHorizontal: 20,
            paddingVertical: 0,
          }}
          textStyle={{ lineHeight: 17, flexShrink: 1 }}
          onPress={() => nav.push("nearby")}
        />
        <Btn
          plain
          label="QRで交換"
          icon="qr"
          style={{ paddingVertical: 0 }}
          textStyle={{ lineHeight: 17 }}
          iconSize={20}
          iconStyle={{ flexShrink: 0 }}
          onPress={() => nav.push("scan")}
        />
      </View>
      {s.connections.some(
        (c) =>
          c.status === "accepted" && !c.vibe && !s.blocked.includes(c.peerId),
      ) && (
        <Btn
          plain
          label="交換した人に印象を贈る"
          onPress={() => nav.push("connections")}
        />
      )}
      {showcase.open && <ShowcasePicker cards={d.deck} selection={showcase} />}
    </Board>
  );
}
