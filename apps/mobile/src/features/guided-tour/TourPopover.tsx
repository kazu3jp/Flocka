import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  Btn,
  C,
  ForegroundColor,
  Icon,
  LinkButton,
  S,
  T,
} from "../../components/ui";
import { ENTER_RISE, MOTION_MS, useEnterMotion } from "../../components/motion";
import {
  placePopover,
  popoverWidth,
  type Insets,
  type Rect,
  type Size,
} from "./tour-geometry";
import { isLastStep, stepAnnouncement, type TourStep } from "./tour-steps";

export const TOUR_TITLE = "Flockaの使い方";

/**
 * The card that explains one step and points at the cut-out. It is measured
 * once at a fixed width, then placed above or below the target inside the
 * safe area; until then it is invisible so it never flashes at a wrong spot.
 * Each step mounts a new popover (the parent keys it), which replays the
 * short rise-and-fade. With reduced motion it appears in place.
 */
export function TourPopover({
  step,
  index,
  total,
  spotlight,
  bounds,
  insets,
  containerRef,
  onNext,
  onPrevious,
  onSkip,
}: {
  step: TourStep;
  index: number;
  total: number;
  spotlight: Rect;
  bounds: Size;
  insets: Insets;
  containerRef: React.RefObject<View | null>;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}) {
  const [size, setSize] = useState<Size | null>(null);
  const width = popoverWidth(bounds, insets);
  const position = size
    ? placePopover({ spotlight, size, bounds, insets })
    : null;
  const placed = position !== null;
  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
    setSize((current) =>
      current &&
      current.width === layout.width &&
      current.height === layout.height
        ? current
        : { width: layout.width, height: layout.height },
    );
  const { progress } = useEnterMotion({
    active: placed,
    duration: MOTION_MS.enter,
  });
  const announcement = stepAnnouncement(index, total);
  const last = isLastStep(index, total);
  const spoken = `${announcement}。${step.title}。${step.lead}`;
  // Screen readers hear the step when it appears; the web moves focus into the popover instead.
  useEffect(() => {
    if (!placed) return;
    if (Platform.OS === "web") {
      (containerRef.current as unknown as HTMLElement | null)?.focus?.({
        preventScroll: true,
      });
    } else {
      AccessibilityInfo.announceForAccessibility(spoken);
    }
  }, [placed, containerRef, spoken]);
  const rise =
    position?.placement === "above" ? ENTER_RISE.item : -ENTER_RISE.item;
  const pointer = {
    position: "absolute" as const,
    width: 14,
    height: 14,
    left: (position?.pointerX ?? 0) - 7,
    backgroundColor: C.paper,
    borderColor: C.ink,
    transform: [{ rotate: "45deg" }],
  };
  return (
    <Animated.View
      ref={containerRef}
      testID="tour-popover"
      role="dialog"
      aria-modal
      aria-label={`${TOUR_TITLE} ${announcement}`}
      accessibilityViewIsModal
      tabIndex={-1}
      onLayout={onLayout}
      style={[
        S.panel,
        {
          position: "absolute",
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          width,
          padding: 14,
          gap: 8,
          opacity: placed ? progress : 0,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [rise, 0],
              }),
            },
          ],
        },
      ]}
    >
      {position?.placement === "below" && (
        <View
          pointerEvents="none"
          style={[
            pointer,
            { top: -8.5, borderTopWidth: 2.5, borderLeftWidth: 2.5 },
          ]}
        />
      )}
      {position?.placement === "above" && (
        <View
          pointerEvents="none"
          style={[
            pointer,
            { bottom: -8.5, borderBottomWidth: 2.5, borderRightWidth: 2.5 },
          ]}
        />
      )}
      <ForegroundColor.Provider value={C.ink}>
        <View
          accessibilityLiveRegion="polite"
          style={{ gap: 6, alignItems: "flex-start" }}
        >
          <View style={[S.row, { gap: 8 }]}>
            <Icon name={step.icon} size={28} />
            <T
              testID="tour-progress"
              size={12}
              color={C.muted}
              accessibilityLabel={announcement}
            >
              {`${index + 1} / ${total}`}
            </T>
          </View>
          <T testID="tour-title" display size={17} style={{ lineHeight: 24 }}>
            {step.title}
          </T>
          <T size={14} style={{ lineHeight: 22.4 }}>
            {step.lead}
          </T>
        </View>
        <View style={[S.row, { marginTop: 4 }]}>
          <View style={S.fill}>
            {last ? null : <LinkButton label="スキップ" onPress={onSkip} />}
          </View>
          {index > 0 && <Btn plain small label="前へ" onPress={onPrevious} />}
          <Btn small label={last ? "はじめる" : "次へ"} onPress={onNext} />
        </View>
      </ForegroundColor.Provider>
    </Animated.View>
  );
}
