import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { PRSegment } from "@flocka/domain";
import { PRCaret } from "./pr-caret";
import { typedLength, useTypedShown, type TypedProgress } from "./use-typed-pr";
import { C, F, T, OUTLINE } from "../../components/ui";

/** Counts code points, and each break as its "\n", exactly like the draft text. */
function visiblePRSegments(segments: PRSegment[], shown: number) {
  const visible: PRSegment[] = [];
  let remaining = shown;
  for (const segment of segments) {
    if (remaining <= 0) break;
    if (segment.kind === "break") {
      visible.push(segment);
      remaining -= 1;
    } else {
      const characters = Array.from(segment.text);
      visible.push({
        ...segment,
        text: characters.slice(0, remaining).join(""),
      });
      remaining -= characters.length;
    }
  }
  return visible;
}

/** Text spans retain the source's inline wrapping, emphasis and writing prompt. */
export function PRBody({
  draft,
  manual,
  segments,
  progress,
  reveal,
}: {
  draft: string;
  manual: boolean;
  segments: PRSegment[];
  progress: TypedProgress;
  reveal: () => void;
}) {
  const shown = useTypedShown(progress);
  const visible = visiblePRSegments(segments, shown);
  return (
    <ScrollView
      testID="pr-body"
      style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ paddingVertical: 14, paddingHorizontal: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable accessibilityLabel="自己PRの全文を表示" onPress={reveal}>
        {manual ? (
          <View style={{ gap: 10 }}>
            {draft.split("\n").map((paragraph, index) => (
              <T
                key={index}
                color={C.ink}
                size={15}
                style={{ lineHeight: 29.25 }}
                selectable
              >
                {paragraph}
              </T>
            ))}
          </View>
        ) : (
          <T
            testID="pr-generated-text"
            color={C.ink}
            size={15}
            style={{ lineHeight: 29.25 }}
            selectable
          >
            {visible.map((segment, index) => {
              if (segment.kind === "break") return "\n";
              return (
                <Text
                  key={index}
                  testID={`pr-segment-${segment.kind}`}
                  style={[
                    segment.kind === "strength" && {
                      backgroundColor: `${C.yellow}8c`,
                      paddingHorizontal: 2,
                      borderRadius: 3,
                    },
                    segment.kind === "quote" && { fontFamily: F.bold },
                    segment.kind === "placeholder" && {
                      color: "#a10128",
                      borderBottomWidth: OUTLINE.width,
                      borderStyle: "dashed",
                      borderColor: "#cc243d",
                      fontFamily: F.bold,
                    },
                  ]}
                >
                  {segment.text}
                </Text>
              );
            })}
            {shown < typedLength(draft) && <PRCaret />}
          </T>
        )}
      </Pressable>
    </ScrollView>
  );
}
