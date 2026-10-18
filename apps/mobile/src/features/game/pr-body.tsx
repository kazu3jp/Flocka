import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { PRSegment } from "@flocka/domain";
import { PRCaret } from "./pr-caret";
import { C, F, T } from "../../components/ui";

function visiblePRSegments(segments: PRSegment[], shown: number) {
  const visible: PRSegment[] = [];
  let remaining = shown;
  for (const segment of segments) {
    if (remaining <= 0) break;
    if (segment.kind === "break") visible.push(segment);
    else {
      visible.push({ ...segment, text: segment.text.slice(0, remaining) });
      remaining -= segment.text.length;
    }
  }
  return visible;
}

/** Text spans retain the source's inline wrapping, emphasis and writing prompt. */
export function PRBody({
  draft,
  manual,
  segments,
  shown,
  reveal,
}: {
  draft: string;
  manual: boolean;
  segments: PRSegment[];
  shown: number;
  reveal: () => void;
}) {
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
                      borderBottomWidth: 2.5,
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
            {shown < draft.length && <PRCaret />}
          </T>
        )}
      </Pressable>
    </ScrollView>
  );
}
