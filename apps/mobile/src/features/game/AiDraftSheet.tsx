import React from "react";
import { View } from "react-native";
import type { PRAiDraft } from "@flocka/domain";
import { Btn, C, F, Sheet, T } from "../../components/ui";

/** Preview of an AI-written draft. Nothing is saved until the user adopts it. */
export function AiDraftSheet({
  draft,
  busy,
  error,
  onAdopt,
  onDiscard,
}: {
  draft: PRAiDraft;
  busy: boolean;
  error: string | null;
  onAdopt: () => void;
  onDiscard: () => void;
}) {
  return (
    <Sheet title="AIが整えた下書き" onClose={onDiscard}>
      <View
        testID="pr-ai-notice"
        style={{
          padding: 10,
          borderWidth: 2,
          borderColor: C.ink,
          borderRadius: 10,
          backgroundColor: C.yellow,
        }}
      >
        <T size={13} style={{ fontFamily: F.bold, lineHeight: 20 }}>
          AIが仲間の言葉をもとに書いた下書きです。仲間の言葉に沿っているかを自動で確かめていますが、使う前に読んで確認してください
        </T>
      </View>
      <T testID="pr-ai-source" size={13} color={C.muted}>
        仲間{draft.source.pieceIds.length}人の言葉から作成
      </T>
      <T testID="pr-ai-text" selectable style={{ lineHeight: 26 }}>
        {draft.text}
      </T>
      {error ? (
        <T accessibilityRole="alert" color={C.danger}>
          {error}
        </T>
      ) : null}
      <Btn label="この下書きを使う" loading={busy} onPress={onAdopt} />
      <Btn plain label="やめる" disabled={busy} onPress={onDiscard} />
    </Sheet>
  );
}
