import React from "react";
import { Animated, View } from "react-native";
import { CARDS, PEER_PROFILE, bareCard } from "@flocka/domain";
import { Avatar, C, Icon, S, StrengthCard, T } from "../../components/ui";
import Svg, { Path, Rect } from "react-native-svg";
import {
  eased,
  tourEasing,
  useOwnSizeTranslate,
  useTourMotion,
} from "./use-tour-motion";

function TourCard({
  cardKey,
  confirmed = false,
  inPlayerCard = false,
  selection,
}: {
  cardKey: string;
  confirmed?: boolean;
  inPlayerCard?: boolean;
  selection?: Animated.Value;
}) {
  const shadow = selection
    ? selection.interpolate({
        easing: tourEasing.pop,
        inputRange: [0, 0.55, 0.7, 1],
        outputRange: [0, 0, 1, 1].map(
          (progress) =>
            `0px 0px 0px ${4 * progress}px ${C.yellow}, ${3 + progress}px ${3 + progress}px 0px 0px ${C.ink}`,
        ),
      })
    : `3px 3px 0 ${C.ink}`;
  return (
    <Animated.View
      style={{
        flex: 1,
        width: "100%",
        marginTop: inPlayerCard ? 4 : 0,
        borderRadius: 14,
        boxShadow: shadow,
      }}
    >
      <StrengthCard
        card={{
          ...bareCard(cardKey),
          ...CARDS[cardKey],
          self: !confirmed,
          confirmed,
          givers: confirmed ? ["a", "b"] : [],
        }}
        style={{ flex: 1, width: "100%", boxShadow: "none" }}
      />
    </Animated.View>
  );
}
function TourOption({
  index,
  reduced,
  scene,
  children,
}: {
  index: number;
  reduced: boolean;
  scene: string;
  children: React.ReactNode;
}) {
  const enter = useTourMotion("option", reduced, scene, 500 + index * 150);
  const own = useOwnSizeTranslate();
  return (
    <Animated.View
      testID={`tour-option-${index}`}
      onLayout={own.onLayout}
      style={[
        S.fill,
        {
          opacity: enter.interpolate(
            eased(tourEasing.pop, {
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
          ),
          transform: [
            {
              translateY: enter.interpolate(
                eased(tourEasing.pop, {
                  inputRange: [0, 1],
                  outputRange: own.percents("height", [40, 0]),
                }),
              ),
            },
            {
              rotate: enter.interpolate(
                eased(tourEasing.pop, {
                  inputRange: [0, 1],
                  outputRange: ["6deg", "0deg"],
                }),
              ),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
function TourDocumentLine({
  width,
  index,
  reduced,
  scene,
}: {
  width: number;
  index: number;
  reduced: boolean;
  scene: string;
}) {
  const progress = useTourMotion("line", reduced, scene, 1300 + index * 300);
  return (
    <Animated.View
      testID={`tour-line-${index}`}
      style={{
        height: 7,
        borderRadius: 4,
        width: `${width}%`,
        backgroundColor: index === 0 ? C.yellow : C.grey,
        transformOrigin: "left",
        transform: [
          {
            scaleX: progress.interpolate(
              eased(tourEasing.ease, {
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            ),
          },
        ],
      }}
    />
  );
}
export function TourScene({
  scene,
  reduced,
}: {
  scene: string;
  reduced: boolean;
}) {
  if (scene === "exchange") return <ExchangeScene reduced={reduced} />;
  if (scene === "guess") return <GuessScene reduced={reduced} />;
  return <PRScene reduced={reduced} />;
}
function ExchangeScene({ reduced }: { reduced: boolean }) {
  const players = useTourMotion("players", reduced, "exchange");
  const swap = useTourMotion("swap", reduced, "exchange");
  // Both player panels share one size, so one measurement converts both.
  const panel = useOwnSizeTranslate();
  return (
    <Animated.View
      accessible={false}
      style={{ position: "absolute", inset: 0 }}
    >
      {[
        ["ソラ", "impl", "mock-b"],
        ["ミナト", "design", "mock-a"],
      ].map(([name, key, id], i) => (
        <Animated.View
          key={key}
          onLayout={panel.onLayout}
          style={[
            S.panel,
            {
              position: "absolute",
              top: "12%",
              width: "40%",
              height: "76%",
              ...(i ? { right: "6%" } : { left: "6%" }),
              padding: 0,
              paddingHorizontal: 8,
              paddingBottom: 10,
              gap: 6,
              alignItems: "center",
              // Until native knows the panel width, its offset is unknown;
              // the panels start off-screen in the source anyway.
              ...(panel.measured ? {} : { opacity: 0 }),
              transform: [
                {
                  translateX: players.interpolate(
                    eased(tourEasing.ease, {
                      inputRange: [0, 0.25, 0.55, 0.75, 1],
                      outputRange: panel.percents(
                        "width",
                        i ? [120, 0, 0, -6, -6] : [-120, 0, 0, 6, 6],
                      ),
                    }),
                  ),
                },
                {
                  rotate: players.interpolate(
                    eased(tourEasing.ease, {
                      inputRange: [0, 0.25, 0.55, 0.75, 1],
                      outputRange: i
                        ? ["8deg", "4deg", "4deg", "2deg", "2deg"]
                        : ["-8deg", "-4deg", "-4deg", "-2deg", "-2deg"],
                    }),
                  ),
                },
              ],
            },
          ]}
        >
          <View
            style={{
              height: 18,
              marginHorizontal: -8,
              marginBottom: 4,
              backgroundColor: C.ink,
              alignSelf: "stretch",
            }}
          />
          <Avatar
            name={name}
            avatar={{ type: "motif", ...PEER_PROFILE[id].avatar }}
            size={44}
          />
          <T display color={C.ink} size={15} style={{ lineHeight: 15 }}>
            {name}
          </T>
          <TourCard cardKey={key} inPlayerCard />
        </Animated.View>
      ))}
      <Animated.View
        testID="tour-swap"
        style={{
          transform: [
            {
              scale: swap.interpolate(
                eased(tourEasing.pop, {
                  inputRange: [0, 0.22, 0.35, 0.45, 0.6, 0.8, 1],
                  outputRange: [0, 0, 1.15, 1, 1, 1, 1],
                }),
              ),
            },
            {
              rotate: swap.interpolate(
                eased(tourEasing.pop, {
                  inputRange: [0, 0.6, 0.8, 1],
                  outputRange: ["0deg", "0deg", "180deg", "180deg"],
                }),
              ),
            },
          ],
          position: "absolute",
          left: "50%",
          top: "50%",
          marginLeft: -26,
          marginTop: -26,
          width: 52,
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `3px 3px 0 ${C.ink}`,
          borderRadius: 26,
          backgroundColor: C.yellow,
          borderWidth: 2.5,
          borderColor: C.ink,
        }}
      >
        <Icon name="swap" color={C.ink} size={26} />
      </Animated.View>
    </Animated.View>
  );
}
function GuessScene({ reduced }: { reduced: boolean }) {
  const scene = "guess";
  const envelope = useTourMotion("envelope", reduced, scene);
  const pick = useTourMotion("pick", reduced, scene);
  return (
    <Animated.View
      accessible={false}
      style={{ position: "absolute", inset: 0 }}
    >
      <Animated.View
        testID="tour-envelope"
        style={{
          transform: [
            {
              translateY: reduced
                ? 0
                : envelope.interpolate(
                    eased(tourEasing.envelope, {
                      inputRange: [0, 1],
                      outputRange: [0, -8],
                    }),
                  ),
            },
            {
              rotate: reduced
                ? "0deg"
                : envelope.interpolate(
                    eased(tourEasing.envelope, {
                      inputRange: [0, 1],
                      outputRange: ["0deg", "-3deg"],
                    }),
                  ),
            },
          ],
          position: "absolute",
          width: "46%",
          left: "27%",
          top: "10%",
          aspectRatio: 44 / 32,
          // The source's inline SVG leaves 6.75px below its baseline.
          boxSizing: "content-box",
          paddingBottom: 6.75,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 44 32"
          style={{ filter: `drop-shadow(4px 4px 0 ${C.ink})` }}
        >
          <Rect
            x={1.5}
            y={1.5}
            width={41}
            height={29}
            rx={4}
            fill={C.paper}
            stroke={C.ink}
            strokeWidth={2.5}
          />
          <Path
            d="M3 4l19 13L41 4"
            stroke={C.ink}
            strokeWidth={2.5}
            fill="none"
          />
        </Svg>
        <View
          testID="tour-seal"
          style={{
            position: "absolute",
            left: "50%",
            top: "52%",
            marginLeft: -20,
            marginTop: -20,
            borderRadius: 20,
            borderWidth: 2.5,
            borderColor: C.ink,
            backgroundColor: C.pink,
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T display size={22} color={C.ink}>
            ?
          </T>
        </View>
      </Animated.View>
      <View
        style={[
          S.row,
          {
            position: "absolute",
            left: "5%",
            right: "5%",
            bottom: "8%",
            height: "46%",
            alignItems: "stretch",
            gap: 8,
          },
        ]}
      >
        {["bridge", "warm", "idea"].map((key, index) => (
          <TourOption key={key} index={index} reduced={reduced} scene={scene}>
            <Animated.View
              style={[
                S.fill,
                index === 0 && {
                  transform: [
                    {
                      translateY: pick.interpolate(
                        eased(tourEasing.pop, {
                          inputRange: [0, 0.55, 0.7, 1],
                          outputRange: [0, 0, -10, -10],
                        }),
                      ),
                    },
                    {
                      rotate: pick.interpolate(
                        eased(tourEasing.pop, {
                          inputRange: [0, 0.55, 0.7, 1],
                          outputRange: ["0deg", "0deg", "-2deg", "-2deg"],
                        }),
                      ),
                    },
                  ],
                },
              ]}
            >
              <TourCard
                cardKey={key}
                selection={index === 0 ? pick : undefined}
              />
            </Animated.View>
          </TourOption>
        ))}
      </View>
    </Animated.View>
  );
}
function PRScene({ reduced }: { reduced: boolean }) {
  const scene = "pr";
  const flip = useTourMotion("flip", reduced, scene);
  const doc = useTourMotion("option", reduced, scene, 900);
  const docSize = useOwnSizeTranslate();

  return (
    <Animated.View
      accessible={false}
      style={{ position: "absolute", inset: 0 }}
    >
      <Animated.View
        testID="tour-confirm"
        style={{
          transform: reduced
            ? undefined
            : [
                { perspective: 600 },
                {
                  rotateY: flip.interpolate(
                    eased(tourEasing.pop, {
                      inputRange: [0, 1],
                      outputRange: ["90deg", "0deg"],
                    }),
                  ),
                },
              ],
          position: "absolute",
          left: "7%",
          top: "14%",
          width: "46%",
          height: "72%",
        }}
      >
        <TourCard cardKey="bridge" confirmed />
      </Animated.View>
      <Animated.View
        testID="tour-document"
        onLayout={docSize.onLayout}
        style={[
          S.panel,
          {
            position: "absolute",
            right: "6%",
            top: "22%",
            width: "40%",
            height: "58%",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 14,
            gap: 9,
            opacity: doc.interpolate(
              eased(tourEasing.pop, {
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            ),
            transform: [
              {
                translateY: doc.interpolate(
                  eased(tourEasing.pop, {
                    inputRange: [0, 1],
                    outputRange: docSize.percents("height", [40, 0]),
                  }),
                ),
              },
              {
                rotate: doc.interpolate(
                  eased(tourEasing.pop, {
                    inputRange: [0, 1],
                    outputRange: ["6deg", "3deg"],
                  }),
                ),
              },
            ],
          },
        ]}
      >
        <T display color={C.ink} size={14} style={{ lineHeight: 14 }}>
          自己PR
        </T>
        {[100, 88, 94, 60].map((width, i) => (
          <TourDocumentLine
            key={width}
            width={width}
            index={i}
            reduced={reduced}
            scene={scene}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}
