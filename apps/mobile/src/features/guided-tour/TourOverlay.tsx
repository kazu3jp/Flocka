import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../../components/ui";
import { MOTION_MS, useEnterMotion } from "../../components/motion";
import { useTour } from "./tour-context";
import {
  TOUR_SPOTLIGHT_PADDING,
  TOUR_SPOTLIGHT_RADIUS,
  dimRects,
  spotlightRect,
  type Rect,
  type Size,
} from "./tour-geometry";
import type { TourTargetRegistry } from "./tour-registry";
import { TourPopover } from "./TourPopover";
import { useTourKeyboard } from "./use-tour-keyboard";
import { useTourSession } from "./use-tour-session";

const DIM = `${C.ink}b8`;
/** Swallows touches so nothing underneath the tour can be pressed. */
const captureTouches = () => true;

function Dim({ rect }: { rect: Rect | null }) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return (
    <View
      onStartShouldSetResponder={captureTouches}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        backgroundColor: DIM,
      }}
    />
  );
}

/** The ring around the element. It also covers the element, so it is not pressable. */
function Ring({ rect }: { rect: Rect }) {
  const { progress } = useEnterMotion({
    active: true,
    duration: MOTION_MS.enter,
  });
  return (
    <Animated.View
      testID="tour-spotlight"
      onStartShouldSetResponder={captureTouches}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderRadius: TOUR_SPOTLIGHT_RADIUS,
        borderWidth: 3,
        borderColor: C.yellow,
        opacity: progress,
      }}
    />
  );
}

function TourStage({ registry }: { registry: TourTargetRegistry }) {
  const { showTab, finish } = useTour();
  const insets = useSafeAreaInsets();
  const overlayRef = useRef<View>(null);
  const popoverRef = useRef<View>(null);
  const [bounds, setBounds] = useState<Size>({ width: 0, height: 0 });
  const onLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
      setBounds((current) =>
        current.width === layout.width && current.height === layout.height
          ? current
          : { width: layout.width, height: layout.height },
      ),
    [],
  );
  const session = useTourSession({
    registry,
    overlayRef,
    bounds,
    showTab,
    finish,
  });
  useTourKeyboard(popoverRef, {
    next: session.next,
    previous: session.previous,
    skip: finish,
  });
  // The hardware back button ends the tour instead of leaving the app.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        finish();
        return true;
      },
    );
    return () => subscription.remove();
  }, [finish]);
  const hole = session.target
    ? spotlightRect(session.target, bounds, TOUR_SPOTLIGHT_PADDING)
    : null;
  const dim = dimRects(bounds, hole);
  return (
    <View
      ref={overlayRef}
      collapsable={false}
      testID="tour-overlay"
      onLayout={onLayout}
      style={StyleSheet.absoluteFill}
    >
      <Dim rect={dim.top} />
      <Dim rect={dim.bottom} />
      <Dim rect={dim.left} />
      <Dim rect={dim.right} />
      {hole && (
        <React.Fragment key={session.index}>
          <Ring rect={hole} />
          <TourPopover
            step={session.step}
            index={session.index}
            total={session.total}
            spotlight={hole}
            bounds={bounds}
            insets={insets}
            containerRef={popoverRef}
            onNext={session.next}
            onPrevious={session.previous}
            onSkip={finish}
          />
        </React.Fragment>
      )}
    </View>
  );
}

/** Draws the tour above the app while it runs. Render it last inside the screen root. */
export function TourOverlay() {
  const { running, registry } = useTour();
  return running && registry ? <TourStage registry={registry} /> : null;
}
