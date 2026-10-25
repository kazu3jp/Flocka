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

/** The one-line message reads larger than the source design's 14px, which was too small on a phone. */
const ROLE_FONT_SIZE = 17;
const ROLE_LINE_HEIGHT = 1.6;

function fanPose(index: number, count: number) {
  if (count === 1) return { angle: 0, verticalOffset: 0 };
  if (count === 2 && index === 1) return { angle: 6, verticalOffset: 0.04 };
  if (index === 1) return { angle: 0, verticalOffset: -0.03 };
  return { angle: index === 0 ? -8 : 8, verticalOffset: 0.06 };
}

/** The source design uses the player container's size, not the window size. */
export function PlayerSurface({
  avatar,
  name,
  role,
  interests,
  cards,
  compact,
  onPick,
  footer,
}: {
  avatar: React.ReactNode;
  name: string;
  role: string;
  interests: string[];
  cards: Card[];
  compact: boolean;
  onPick?: () => void;
  footer?: React.ReactNode;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
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
  const nameSize = compact
    ? Math.max(26, Math.min(38, contentHeight * 0.075))
    : Math.max(34, Math.min(56, contentHeight * 0.14));
  const handWidth = Math.max(0, size.width - 36);
  const cardWidth = handWidth * 0.64;
  const cardHeight = cardWidth * (164 / 176);
  return (
    <Panel
      testID="player-card"
      style={{
        flex: 1,
        minHeight: 0,
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
          testID="player-identity"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 14,
          }}
        >
          {avatar}
          <T
            testID="player-name"
            display
            size={nameSize}
            color={C.ink}
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
          size={ROLE_FONT_SIZE}
          color={C.muted}
          style={{
            paddingHorizontal: 16,
            lineHeight: ROLE_FONT_SIZE * ROLE_LINE_HEIGHT,
          }}
        >
          {role}
        </T>
        {(showHand || (onPick && contentHeight > 0)) && (
          <>
            <View
              testID="player-strength-label"
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
              <T
                testID="player-strength-names"
                size={14}
                color={C.ink}
                numberOfLines={2}
                style={{
                  paddingHorizontal: 16,
                  fontFamily: F.bold,
                  lineHeight: 23.1,
                }}
              >
                {cards.length
                  ? cards.map((card) => card.name).join("・")
                  : "まだ選んでいません"}
              </T>
            )}
            {showHand && (
              <View
                testID="player-hand"
                accessibilityLabel="相手に見せる強み"
                style={{
                  flex: 1,
                  minHeight: 0,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingTop: 8,
                  paddingBottom: 4,
                }}
              >
                {cards.map((card, index) => {
                  const pose = fanPose(index, cards.length);
                  return (
                    <StrengthCard
                      key={card.key}
                      card={card}
                      style={{
                        width: cardWidth,
                        height: cardHeight,
                        flexShrink: 0,
                        marginLeft: index ? -handWidth * 0.46 : 0,
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
