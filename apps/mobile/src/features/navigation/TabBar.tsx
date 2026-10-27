import React, { useEffect, useMemo, useState } from "react";
import { Animated, View, type LayoutChangeEvent } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { Tab } from "@flocka/domain";
import { C, F, Icon, LAYOUT, SP, T } from "../../components/ui";
import {
  MOTION_EASE,
  MOTION_MS,
  NATIVE_DRIVER,
  PopOnChange,
  SquishPressable,
  useReduceMotion,
} from "../../components/motion";

type TabItem = {
  tab: Tab;
  label: string;
  icon: string;
  /** Text of the pink badge, or null for none. */
  badge: string | null;
};

// The source's .tabbar pads 10px at the sides and shares the rest in thirds.
const SIDE_PADDING = LAYOUT.blockGap;
const TOP_PADDING = SP.xs;

/** The yellow pill slides to the selected tab instead of jumping. */
function useSlidingPill(activeIndex: number) {
  const reduced = useReduceMotion();
  const [position] = useState(() => new Animated.Value(activeIndex));
  useEffect(() => {
    if (reduced) {
      position.setValue(activeIndex);
      return;
    }
    const animation = Animated.timing(position, {
      toValue: activeIndex,
      duration: MOTION_MS.toast,
      easing: MOTION_EASE,
      useNativeDriver: NATIVE_DRIVER,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [activeIndex, position, reduced]);
  return position;
}

export function TabBar({
  items,
  current,
  onSelect,
}: {
  items: TabItem[];
  current: Tab;
  onSelect: (tab: Tab) => void;
}) {
  const safeInsets = useSafeAreaInsets();
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.tab === current),
  );
  const position = useSlidingPill(activeIndex);
  const [rowWidth, setRowWidth] = useState(0);
  const itemWidth = (rowWidth - SIDE_PADDING * 2) / items.length;
  const translateX = useMemo(
    () =>
      position.interpolate({
        inputRange: items.map((_, index) => index),
        outputRange: items.map((_, index) => index * itemWidth),
      }),
    [position, items, itemWidth],
  );
  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
    setRowWidth((width) => (width === layout.width ? width : layout.width));
  // Until the row is measured the selected tab paints its own pill.
  const pillReady = rowWidth > 0;
  return (
    <SafeAreaView edges={["bottom"]} style={{ backgroundColor: C.ink }}>
      <View
        onLayout={onLayout}
        style={{
          flexDirection: "row",
          paddingHorizontal: SIDE_PADDING,
          paddingTop: TOP_PADDING,
          paddingBottom: Math.max(0, SIDE_PADDING - safeInsets.bottom),
        }}
      >
        {pillReady && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: TOP_PADDING,
              left: SIDE_PADDING,
              width: itemWidth,
              height: LAYOUT.tabItemHeight,
              borderRadius: 12,
              backgroundColor: C.yellow,
              transform: [{ translateX }],
            }}
          />
        )}
        {items.map(({ tab, label, icon, badge }) => {
          const active = current === tab;
          return (
            <SquishPressable
              key={tab}
              pressScale={0.94}
              accessibilityRole="tab"
              aria-selected={active}
              accessibilityLabel={label}
              onPress={() => onSelect(tab)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                minHeight: LAYOUT.tabItemHeight,
                borderRadius: 12,
                backgroundColor:
                  active && !pillReady ? C.yellow : "transparent",
              }}
            >
              <Icon name={icon} color={active ? C.ink : C.tabInactive} />
              <T
                size={12}
                numberOfLines={1}
                color={active ? C.ink : C.tabInactive}
                style={{ fontFamily: F.bold, lineHeight: 19.8 }}
              >
                {label}
              </T>
              {badge ? (
                <PopOnChange
                  trigger={badge}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 4,
                    left: "50%",
                    marginLeft: 8,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: 9,
                    backgroundColor: C.pink,
                    borderWidth: 2,
                    borderColor: C.ink,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <T
                    size={10.5}
                    color={C.ink}
                    style={{ fontFamily: F.bold, lineHeight: 14 }}
                  >
                    {badge}
                  </T>
                </PopOnChange>
              ) : null}
            </SquishPressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
