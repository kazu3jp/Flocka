import React from "react";
import { View } from "react-native";
import { SkeletonBlock, Spinner } from "./motion";
import { Board, T } from "./ui";
import { C } from "./theme";

/** Spinner on the blue board, for places the whole screen waits on the server. */
export function Loader({ size = 20 }: { size?: number }) {
  return <Spinner size={size} color={C.yellow} trackColor={`${C.white}33`} />;
}

/** Spinner on the paper sheet, where the yellow arc would not show. */
export function InkLoader({ size = 20 }: { size?: number }) {
  return <Spinner size={size} color={C.ink} trackColor={`${C.ink}22`} />;
}

/** A whole-screen wait: the branded spinner above the same status text. */
export function LoadingBoard({ label }: { label: string }) {
  return (
    <Board>
      <View style={{ alignItems: "center", gap: 14 }}>
        <Loader size={32} />
        <T color={C.pale} accessibilityLiveRegion="polite">
          {label}
        </T>
      </View>
    </Board>
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
