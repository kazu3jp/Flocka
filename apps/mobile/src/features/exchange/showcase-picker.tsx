import React, { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import type { Card } from "@flocka/domain";
import { Btn, C, Sheet, StrengthCard, T } from "../../components/ui";
import { useModalFrame } from "../../components/app-frame";
import type { useShowcase } from "./use-showcase";

// Sheet content padding on each side.
const SHEET_PADDING = 18;
const CHOICE_HEIGHT = 150;

export function ShowcasePicker({
  cards,
  selection,
}: {
  cards: Card[];
  selection: ReturnType<typeof useShowcase>;
}) {
  // The sheet spans the window (or the web preview frame), so the grid width
  // is known before layout; measuring only corrects cases like a scrollbar.
  const frame = useModalFrame();
  const windowSize = useWindowDimensions();
  const expectedWidth = (frame?.width ?? windowSize.width) - SHEET_PADDING * 2;
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const width = measuredWidth ?? expectedWidth;
  return (
    <Sheet title="相手に見せる強み（3枚まで）" onClose={selection.close}>
      <View
        testID="showcase-grid"
        onLayout={({ nativeEvent: { layout } }) =>
          setMeasuredWidth(layout.width === expectedWidth ? null : layout.width)
        }
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
      >
        {cards.map((card) => {
          const index = selection.chosen.indexOf(card.key);
          const selected = index >= 0;
          return (
            <Pressable
              key={card.key}
              testID={`showcase-choice-${card.key}`}
              accessibilityRole="button"
              accessibilityLabel={card.name}
              accessibilityState={{ selected, disabled: selection.busy }}
              aria-pressed={selected}
              disabled={selection.busy}
              onPress={() => selection.toggle(card.key)}
              style={{
                width: Math.max(0, (width - 20) / 3),
                height: CHOICE_HEIGHT,
                borderRadius: 14,
                transform: [{ translateY: selected ? -3 : 0 }],
              }}
            >
              <StrengthCard
                card={card}
                style={{
                  height: "100%",
                  opacity: selected ? 1 : 0.55,
                  ...(selected
                    ? { boxShadow: `0 0 0 3px ${C.yellow}, 4px 4px 0 ${C.ink}` }
                    : {}),
                }}
                height={CHOICE_HEIGHT}
              />
              {selected && (
                <View
                  testID={`showcase-order-${card.key}`}
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -6,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: 2.5,
                    borderColor: C.ink,
                    backgroundColor: C.yellow,
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 4,
                  }}
                >
                  <T display size={14} color={C.ink} style={{ lineHeight: 14 }}>
                    {index + 1}
                  </T>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {selection.error && (
        <T accessibilityRole="alert" color={C.danger}>
          {selection.error}
        </T>
      )}
      <Btn
        label={selection.busy ? "保存中…" : "決定"}
        disabled={selection.busy}
        onPress={selection.finish}
        textStyle={{ lineHeight: 17 }}
      />
    </Sheet>
  );
}
