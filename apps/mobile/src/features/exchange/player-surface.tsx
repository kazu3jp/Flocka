import React, {
  useId,
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  Pressable,
  StyleSheet,
  View,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import type { Card } from "@flocka/domain";
import { C, F, Icon, Panel, StrengthCard, T } from "../../components/ui";
import {
  fanCardHeightFor,
  fitDisplayName,
} from "../../components/responsive-scale";
import { useTourTarget } from "../guided-tour/use-tour-target";
import { useSectionHeights } from "./use-section-heights";

/** The one-line message reads larger than the source design's 14px, which was too small on a phone. */
const ROLE_FONT_SIZE = 17;
const ROLE_LINE_HEIGHT = 1.6;
/** Space between the name row and the one-line message. */
const ROLE_GAP_ABOVE = 18;
/** Smallest name the card shrinks to before it lets a long name use two lines. */
const NAME_MIN_SIZE = 16;
/** Horizontal padding of the identity row, and the gap between avatar and name. */
const IDENTITY_PADDING_X = 16;
const IDENTITY_GAP = 12;
/** Space the hand keeps above and below the cards, and the smallest card worth fanning. */
const HAND_PADDING_Y = 12;
const MIN_FAN_CARD_HEIGHT = 96;
const CARD_ASPECT = 176 / 164;
const PANEL_BORDER = 2.5;

function fanPose(index: number, count: number) {
  if (count === 1) return { angle: 0, verticalOffset: 0 };
  if (count === 2 && index === 1) return { angle: 6, verticalOffset: 0.04 };
  if (index === 1) return { angle: 0, verticalOffset: -0.03 };
  return { angle: index === 0 ? -8 : 8, verticalOffset: 0.06 };
}

/** The shown cards by name, for panels too short to fan them out. */
function StrengthNames({
  cards,
  inset = 16,
  onLayout,
}: {
  cards: Card[];
  inset?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <T
      testID="player-strength-names"
      onLayout={onLayout}
      size={14}
      color={C.ink}
      numberOfLines={2}
      style={{
        paddingHorizontal: inset,
        fontFamily: F.bold,
        lineHeight: 23.1,
      }}
    >
      {cards.length
        ? cards.map((card) => card.name).join("・")
        : "まだ選んでいません"}
    </T>
  );
}

/** The source design uses the player container's size, not the window size. */
export function PlayerSurface({
  avatar,
  avatarSize,
  name,
  role,
  interests,
  cards,
  compact,
  onPick,
  footer,
  tourTargetId = null,
}: {
  avatar: React.ReactNode;
  /** Width the avatar takes in the identity row, which the name shares. */
  avatarSize: number;
  name: string;
  role: string;
  interests: string[];
  cards: Card[];
  compact: boolean;
  onPick?: () => void;
  footer?: React.ReactNode;
  /** Marks the name row as a guided tour target; only the person's own card is one. */
  tourTargetId?: string | null;
}) {
  const tourTarget = useTourTarget(tourTargetId);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [handHeight, setHandHeight] = useState(0);
  const sections = useSectionHeights();
  const measuredView = useRef<View>(null);
  const { width, height, fontScale } = useWindowDimensions();
  const recordSize = useCallback((width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    setSize((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height },
    );
  }, []);
  useLayoutEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    measuredView.current?.measure((_x, _y, width, height) => {
      if (active) recordSize(width, height);
    });
    return () => {
      active = false;
    };
  }, [width, height, fontScale, recordSize]);
  const id = `player-${useId().replace(/:/g, "")}`;
  const contentHeight = size.height;
  const showHand = contentHeight > (compact ? 360 : 520);
  // The size the card's height allows. A narrow phone is as tall as a wide
  // one, so the name must also fit the width left beside the avatar.
  const roomySize = compact
    ? Math.max(26, Math.min(38, contentHeight * 0.075))
    : Math.max(34, Math.min(56, contentHeight * 0.14));
  const nameSize = fitDisplayName({
    name,
    availableWidth:
      size.width - 2 * IDENTITY_PADDING_X - avatarSize - IDENTITY_GAP,
    maxSize: roomySize,
    minSize: Math.min(NAME_MIN_SIZE, roomySize),
    fontScale,
  });
  const handWidth = Math.max(0, size.width - 36);
  const widthCardHeight = handWidth * 0.64 * (164 / 176);
  // The fan takes the room the hand really has (a large font leaves less),
  // so rotated cards never reach the label above or the footer below.
  const fanCardHeight =
    handHeight > 0
      ? fanCardHeightFor(handHeight - HAND_PADDING_Y, MIN_FAN_CARD_HEIGHT)
      : widthCardHeight;
  const fanFits = fanCardHeight > 0;
  const cardHeight = Math.min(widthCardHeight, fanCardHeight);
  const cardWidth = Math.min(handWidth * 0.64, cardHeight * CARD_ASPECT);
  const cardOverlap = cardWidth * (0.46 / 0.64);
  // Least height the panel needs: its fixed parts and a two-line list of the
  // strengths. A screen that offers less scrolls instead of clipping them.
  const minimumHeight =
    sections.total +
    (showHand ? HAND_PADDING_Y + 2 * 23.1 * Math.max(1, fontScale) : 0) +
    2 * PANEL_BORDER;
  return (
    <Panel
      testID="player-card"
      style={{
        flex: 1,
        minHeight: minimumHeight,
        padding: 0,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      <View
        style={{ flex: 1, minHeight: 0 }}
        ref={measuredView}
        collapsable={false}
        onLayout={({ nativeEvent: { layout } }) =>
          recordSize(layout.width, layout.height)
        }
      >
        <Svg
          pointerEvents="none"
          width="100%"
          height="100%"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <RadialGradient id={`${id}-dot`}>
              <Stop offset="85.714%" stopColor={C.ink} stopOpacity={0.08} />
              <Stop offset="100%" stopColor={C.ink} stopOpacity={0} />
            </RadialGradient>
            <Pattern
              id={`${id}-paper`}
              width={14}
              height={14}
              patternUnits="userSpaceOnUse"
            >
              <Circle cx={7} cy={7} r={1.4} fill={`url(#${id}-dot)`} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id}-paper)`} />
        </Svg>
        <View
          testID="player-heading"
          onLayout={sections.measure("heading")}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: C.ink,
          }}
        >
          <T
            display
            size={13}
            color={C.yellow}
            style={{ lineHeight: 13, letterSpacing: 0.52 }}
          >
            プレイヤーカード
          </T>
        </View>
        <View
          {...tourTarget}
          testID="player-identity"
          onLayout={sections.measure("identity")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: IDENTITY_GAP,
            paddingHorizontal: IDENTITY_PADDING_X,
            paddingTop: 14,
          }}
        >
          {avatar}
          <T
            testID="player-name"
            display
            size={nameSize}
            color={C.ink}
            numberOfLines={2}
            style={{
              flexShrink: 1,
              minWidth: 0,
              lineHeight: nameSize * (compact ? 1.25 : 1.2),
            }}
          >
            {name}
          </T>
        </View>
        <T
          testID="player-role"
          onLayout={sections.measure("role")}
          size={ROLE_FONT_SIZE}
          color={C.muted}
          style={{
            paddingHorizontal: 16,
            paddingTop: ROLE_GAP_ABOVE,
            lineHeight: ROLE_FONT_SIZE * ROLE_LINE_HEIGHT,
          }}
        >
          {role}
        </T>
        {(showHand || (onPick && contentHeight > 0)) && (
          <>
            <View
              testID="player-strength-label"
              onLayout={sections.measure("strength-label")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingTop: 12,
              }}
            >
              <T display size={13} color={C.ink} style={{ lineHeight: 13 }}>
                強み
              </T>
              {onPick && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="選ぶ"
                  onPress={onPick}
                  style={{
                    minHeight: 36,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  <Icon name="edit" size={15} color={C.ink} />
                  <T
                    display
                    size={13}
                    color={C.ink}
                    style={{
                      lineHeight: 13,
                      fontWeight: "700",
                      textDecorationLine: "underline",
                    }}
                  >
                    選ぶ
                  </T>
                </Pressable>
              )}
            </View>
            {/* Short panels keep the picker reachable and name the shown cards instead of the hand. */}
            {!showHand && (
              <StrengthNames
                cards={cards}
                onLayout={sections.measure("strength-names")}
              />
            )}
            {showHand && (
              <View
                testID="player-hand"
                accessibilityLabel="相手に見せる強み"
                onLayout={({ nativeEvent: { layout } }) =>
                  setHandHeight(layout.height)
                }
                style={{
                  flex: 1,
                  minHeight: 0,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: fanFits ? "center" : "flex-start",
                  paddingHorizontal: 18,
                  paddingTop: 8,
                  paddingBottom: 4,
                }}
              >
                {!fanFits && <StrengthNames cards={cards} inset={0} />}
                {fanFits &&
                  cards.map((card, index) => {
                    const pose = fanPose(index, cards.length);
                    return (
                      <StrengthCard
                        key={card.key}
                        card={card}
                        style={{
                          width: cardWidth,
                          height: cardHeight,
                          flexShrink: 0,
                          marginLeft: index ? -cardOverlap : 0,
                          zIndex: index === 1 ? 2 : 1,
                          transform: [
                            { rotate: `${pose.angle}deg` },
                            { translateY: cardHeight * pose.verticalOffset },
                          ],
                        }}
                        height={cardHeight}
                      />
                    );
                  })}
              </View>
            )}
          </>
        )}
        <View
          testID="player-footer"
          onLayout={sections.measure("footer")}
          style={{
            marginTop: "auto",
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 14,
            gap: 12,
          }}
        >
          {interests.length > 0 && (
            <View
              accessibilityLabel="関心のある分野"
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
                minWidth: 0,
              }}
            >
              <T
                display
                size={12}
                color={C.paper}
                style={{
                  lineHeight: 12,
                  backgroundColor: C.ink,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                }}
              >
                関心
              </T>
              {interests.map((interest) => (
                <View
                  key={interest}
                  style={{
                    minHeight: 28,
                    paddingHorizontal: 10,
                    borderRadius: 99,
                    borderWidth: 2,
                    borderColor: C.ink,
                    backgroundColor: C.paper2,
                    justifyContent: "center",
                  }}
                >
                  <T
                    size={12.5}
                    color={C.ink}
                    style={{ fontFamily: F.bold, lineHeight: 20.625 }}
                  >
                    #{interest}
                  </T>
                </View>
              ))}
            </View>
          )}
          {footer}
        </View>
      </View>
    </Panel>
  );
}
