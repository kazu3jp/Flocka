import React from "react";
import { View } from "react-native";
import { SkeletonBlock, Spinner } from "./motion";
import { Brand, T } from "./text";
import { C, F } from "./theme";

/** Spinner on the blue board, for places the whole screen waits on the server. */
function Loader({ size = 20 }: { size?: number }) {
  return <Spinner size={size} color={C.yellow} trackColor={`${C.white}33`} />;
}

/**
 * The launch cover: the welcome screen's brand (icon, Flocka, tagline) over a
 * spinner, the same through font loading, the session check and the deck
 * load, so the steps behind it never show. Screen readers hear `label`.
 * Before the fonts load, the words keep their place but stay invisible.
 */
export function LaunchCover({
  label,
  fontsLoaded = true,
}: {
  label: string;
  fontsLoaded?: boolean;
}) {
  return (
    <View
      testID="launch-cover"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={{
        flex: 1,
        backgroundColor: C.blue,
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 24,
      }}
    >
      <View style={{ alignItems: "center", gap: 14 }}>
        <Brand size={88} />
        <View
          style={{
            alignItems: "center",
            gap: 6,
            opacity: fontsLoaded ? 1 : 0,
          }}
        >
          <T display size={30} style={{ lineHeight: 36 }}>
            Flocka
          </T>
          <T size={13} color={C.pale} style={{ fontFamily: F.bold }}>
            仲間の言葉で、強みが見つかる
          </T>
        </View>
      </View>
      <Loader size={28} />
    </View>
  );
}

/**
 * An inline wait next to its text. The spinner box has a fixed size, so the
 * row is the same height whether or not it is shown.
 */
export function LoadingNotice({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <Loader size={16} />
      {children}
    </View>
  );
}

/** Lines shaped like the paragraphs of a list that is still loading. */
export function ParagraphSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <View
      testID="paragraph-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="読み込み中"
      style={{ gap: 10 }}
    >
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBlock
          key={index}
          color={`${C.ink}26`}
          style={{
            height: 14,
            borderRadius: 7,
            width: index === lines - 1 ? "60%" : "100%",
          }}
        />
      ))}
    </View>
  );
}
