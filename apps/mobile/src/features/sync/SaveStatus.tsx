import React from "react";
import { View } from "react-native";
import { C, LinkButton, Panel, S, SP, LAYOUT, T } from "../../components/ui";
import { useAppStatus } from "../../store";

/**
 * Says whether the settings and drafts are on the server. The row keeps one
 * height in every state, so a change of state never moves the screen.
 */
export function SaveStatus() {
  const { saveState, savePaused, retrySave } = useAppStatus();
  const text =
    saveState === "saved"
      ? "サーバーに保存されています"
      : saveState === "saving"
        ? "保存しています…"
        : savePaused
          ? "別の端末の変更を確認するまで保存を止めています"
          : "サーバーに保存できていません。自動で再試行します";
  return (
    <Panel>
      <View
        style={[S.row, { minHeight: LAYOUT.touchTarget, gap: SP.sm }]}
        accessibilityLiveRegion="polite"
        testID="save-status"
      >
        <View style={S.fill}>
          <T
            color={saveState === "failed" ? C.danger : C.muted}
            size={13}
            numberOfLines={2}
          >
            {text}
          </T>
        </View>
        {saveState === "failed" && !savePaused && (
          <LinkButton label="今すぐ再試行" onPress={retrySave} />
        )}
      </View>
    </Panel>
  );
}
