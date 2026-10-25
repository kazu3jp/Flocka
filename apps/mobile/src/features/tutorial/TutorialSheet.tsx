import React, { useState } from "react";
import { View } from "react-native";
import { Btn, C, Icon, LinkButton, S, Sheet, T } from "../../components/ui";
import { TUTORIAL_STEPS, isLastStep, stepAfter } from "./tutorial-steps";

/**
 * The tutorial as a sheet, like the app's other overlays. Closing it by any
 * route (skip, ×, backdrop, Esc, Done) ends it. Steps change without motion,
 * and the text area keeps one height so the buttons never move.
 */
export function TutorialSheet({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = TUTORIAL_STEPS[index];
  const last = isLastStep(index);
  return (
    <Sheet title="Flockaの使い方" onClose={onClose}>
      <View
        testID="tutorial-step"
        accessibilityLiveRegion="polite"
        style={{ minHeight: 168, gap: 10, alignItems: "flex-start" }}
      >
        <Icon name={step.icon} size={36} />
        <T size={12} color={C.muted}>
          {`${index + 1} / ${TUTORIAL_STEPS.length}`}
        </T>
        <T display size={19} style={{ lineHeight: 27 }}>
          {step.title}
        </T>
        <T size={14} style={{ lineHeight: 22.4 }}>
          {step.lead}
        </T>
      </View>
      <View
        accessible
        accessibilityLabel={`${TUTORIAL_STEPS.length}枚中${index + 1}枚目`}
        style={[S.row, { justifyContent: "center", gap: 8 }]}
      >
        {TUTORIAL_STEPS.map((item, i) => (
          <View
            key={item.key}
            testID={i === index ? "tutorial-dot-current" : "tutorial-dot"}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === index ? C.blue : C.grey,
            }}
          />
        ))}
      </View>
      <View style={S.row}>
        <View style={S.fill}>
          {last ? null : <LinkButton label="スキップ" onPress={onClose} />}
        </View>
        {index > 0 && (
          <Btn
            plain
            small
            label="前へ"
            onPress={() => setIndex(stepAfter(index, -1))}
          />
        )}
        <Btn
          small
          label={last ? "はじめる" : "次へ"}
          onPress={() => (last ? onClose() : setIndex(stepAfter(index, 1)))}
        />
      </View>
    </Sheet>
  );
}
