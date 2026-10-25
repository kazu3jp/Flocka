import React from "react";
import { Pressable, TextInput, View } from "react-native";
import { PR_DRAFT_MAX_LENGTH } from "@flocka/domain";
import {
  Avatar,
  Board,
  Btn,
  C,
  F,
  Header,
  Icon,
  Panel,
  S,
  Sheet,
  T,
} from "../../components/ui";
import { useApp } from "../../store";
import { LoadingNotice } from "../../components/loading";
import { usePRDocument } from "./use-pr-document";
import { useTypedPR } from "./use-typed-pr";
import { PRBody } from "./pr-body";
import { AiDraftSheet } from "./AiDraftSheet";
import { useAiPRDraft } from "./use-ai-pr-draft";

export function PR() {
  const { d, nav, setOpening, peers } = useApp();
  const editor = usePRDocument();
  const ai = useAiPRDraft(editor.generatedCardKey);
  const { progress, reveal } = useTypedPR(
    editor.draft,
    editor.manual,
    editor.replay,
  );
  const document = editor.document;
  // A hand-edited draft is the user's own text, so it stays available even
  // when no confirmed card can generate a document any more.
  if (!document && !editor.manual)
    return (
      <Board>
        <Header title="自己PR" />
        <Panel testID="pr-locked" style={{ padding: 0, overflow: "hidden" }}>
          <View style={styles.heading}>
            <Icon name="lock" size={18} color={C.ink} />
            <T
              display
              color={C.ink}
              size={16}
              style={{ flex: 1, lineHeight: 20.8 }}
            >
              まだ書けません
            </T>
          </View>
          <View style={{ padding: 16 }}>
            <T color={C.ink} size={14} style={{ lineHeight: 22.4 }}>
              同じ強みに<TextStrong>2人以上の証言</TextStrong>
              がそろうと「確認済みカード」になり、その証言だけで自己PRの下書きが書き上がります。
            </T>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 12,
                gap: 6,
              }}
            >
              {[0, 1].map((index) => (
                <View
                  key={index}
                  style={{
                    width: 18,
                    height: 18,
                    borderWidth: 2,
                    borderColor: C.ink,
                    borderRadius: 9,
                    backgroundColor: index < d.best ? C.ink : "transparent",
                  }}
                />
              ))}
              <T
                color={C.ink}
                size={14}
                style={{ fontFamily: F.bold, lineHeight: 22.4 }}
              >
                いちばん多いカード：証言{d.best}/2
              </T>
            </View>
          </View>
        </Panel>
        <View style={S.fill} />
        <Btn
          label={d.unopened.length ? "封筒を開ける" : "カードを交換する"}
          onPress={() =>
            d.unopened.length
              ? setOpening(d.unopened[0].id)
              : nav.goTab("exchange")
          }
        />
      </Board>
    );
  return (
    <Board>
      <Header
        title="自己PR"
        right={
          <View
            testID="pr-count"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              minHeight: 32,
              paddingHorizontal: 10,
              borderRadius: 99,
              backgroundColor: C.ink,
            }}
          >
            <T size={12.5} style={{ fontFamily: F.bold, lineHeight: 20.625 }}>
              約
            </T>
            <T display size={15} color={C.yellow} style={{ lineHeight: 15 }}>
              {editor.draft.length}
            </T>
            <T size={12.5} style={{ fontFamily: F.bold, lineHeight: 20.625 }}>
              字
            </T>
          </View>
        }
      />
      <Panel
        testID="pr-document"
        style={{ flex: 1, minHeight: 0, padding: 0, overflow: "hidden" }}
      >
        <View testID="pr-heading" style={styles.heading}>
          <T
            color={C.ink}
            display
            size={16}
            style={{ flex: 1, lineHeight: 20.8 }}
          >
            {editor.sourceKnown && document
              ? `強み：${document.card.name}`
              : "保存した下書き"}
          </T>
          {editor.canRegenerate && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="もう一度書き出す"
              onPress={editor.askReset}
              disabled={editor.busy}
              hitSlop={4}
              style={{
                width: 44,
                height: 44,
                marginVertical: -4,
                marginRight: -6,
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="redo" size={18} color={C.ink} />
            </Pressable>
          )}
        </View>
        {editor.editing ? (
          <View style={{ flex: 1, minHeight: 0 }}>
            <TextInput
              testID="pr-editor"
              accessibilityLabel="自己PRを編集"
              autoFocus
              multiline
              editable={!editor.busy}
              maxLength={PR_DRAFT_MAX_LENGTH}
              value={editor.draft}
              onChangeText={editor.change}
              style={{
                flex: 1,
                minHeight: 0,
                borderWidth: 0,
                paddingVertical: 14,
                paddingHorizontal: 16,
                fontFamily: F.body,
                fontSize: 15,
                lineHeight: 29.25,
                textAlignVertical: "top",
                color: C.ink,
                backgroundColor: C.paper,
              }}
            />
            <T
              testID="pr-editor-count"
              accessibilityLiveRegion="polite"
              color={
                editor.draft.length >= PR_DRAFT_MAX_LENGTH ? C.danger : C.muted
              }
              size={12}
              style={{
                fontFamily: F.bold,
                lineHeight: 18,
                textAlign: "right",
                paddingHorizontal: 14,
                paddingBottom: 6,
              }}
            >
              {editor.draft.length}/{PR_DRAFT_MAX_LENGTH}
            </T>
          </View>
        ) : (
          <PRBody
            draft={editor.draft}
            manual={editor.manual}
            segments={document?.segments ?? []}
            progress={progress}
            reveal={reveal}
          />
        )}
        <View
          testID="pr-sources"
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            paddingHorizontal: 14,
            paddingTop: 8,
            paddingBottom: 10,
            borderTopWidth: 2,
            borderStyle: "dashed",
            borderColor: C.grey,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              minHeight: 28,
              paddingHorizontal: 9,
              borderWidth: 2,
              borderColor: C.ink,
              borderRadius: 99,
              backgroundColor: C.paper2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {(editor.sourceKnown && document ? document.sources : []).map(
                (id, index) => (
                  <View key={id} style={{ marginLeft: index ? -6 : 0 }}>
                    <Avatar
                      name={peers[id]?.profile.name ?? "プロフィールを取得中"}
                      avatar={peers[id]?.profile.avatar}
                      size={20}
                    />
                  </View>
                ),
              )}
            </View>
            <T
              color={C.ink}
              size={12}
              style={{ fontFamily: F.bold, lineHeight: 19.8 }}
            >
              {editor.sourceKnown && document
                ? `仲間${document.sources.length}人の証言から作成`
                : "出典を確認できない保存済みの下書き"}
            </T>
          </View>
        </View>
      </Panel>
      {(editor.error || ai.generateError) && !editor.confirmReset ? (
        <T accessibilityRole="alert" color={C.yellow}>
          {editor.error ?? ai.generateError}
        </T>
      ) : null}
      {ai.generating && (
        <LoadingNotice testID="pr-ai-progress">
          <T
            accessibilityLiveRegion="polite"
            size={12.5}
            color={C.pale}
            style={{ textAlign: "center", lineHeight: 19.375 }}
          >
            AIが文章を整えています。数秒かかります…
          </T>
        </LoadingNotice>
      )}
      <T
        testID="pr-note"
        size={12.5}
        color={C.pale}
        style={{ textAlign: "center", lineHeight: 19.375 }}
      >
        {editor.manual
          ? "手直しやAIで整えた文章です。仲間の言葉と違う内容が入っていないか確認してから使ってください。"
          : "仲間の実際の言葉だけで組み立てた下書きです。経験や成果は足していません。"}
      </T>
      {!editor.editing && editor.canRegenerate && (
        <Btn
          plain
          label="AIで文章を整える"
          loading={ai.generating}
          disabled={!ai.available || editor.busy}
          onPress={ai.generate}
        />
      )}
      <View testID="pr-actions" style={{ flexDirection: "row", gap: 10 }}>
        <Btn
          style={S.fill}
          plain
          label={
            editor.editing ? (editor.busy ? "保存中…" : "完了") : "書き直す"
          }
          icon="edit"
          iconSize={18}
          loading={editor.busy && !editor.confirmReset}
          onPress={() => {
            if (editor.editing) void editor.finish();
            else {
              reveal();
              editor.beginEditing();
            }
          }}
        />
        {editor.canShare && (
          <Btn
            plain
            label="共有"
            style={{ paddingHorizontal: 14 }}
            disabled={editor.busy}
            onPress={editor.share}
          />
        )}
        <Btn
          style={S.fill}
          label="コピー"
          icon="copy"
          iconSize={18}
          onPress={editor.copy}
        />
      </View>
      {ai.preview && (
        <AiDraftSheet
          draft={ai.preview}
          busy={ai.adopting}
          error={ai.adoptError}
          onAdopt={ai.adopt}
          onDiscard={ai.discard}
        />
      )}
      {editor.confirmReset && editor.canRegenerate && (
        <Sheet title="もう一度書き出す？" onClose={editor.closeReset}>
          <T>
            手で編集した内容を消して、「{editor.regenerationStrength}
            」の現在の証言から下書きを作ります。
          </T>
          {editor.error ? (
            <T accessibilityRole="alert" color={C.danger}>
              {editor.error}
            </T>
          ) : null}
          <Btn
            label={editor.busy ? "保存中…" : "書き出す"}
            loading={editor.busy}
            onPress={editor.regenerate}
          />
          <Btn
            plain
            label="キャンセル"
            disabled={editor.busy}
            onPress={editor.closeReset}
          />
        </Sheet>
      )}
    </Board>
  );
}

function TextStrong({ children }: { children: React.ReactNode }) {
  return (
    <T color={C.ink} size={14} style={{ fontFamily: F.bold, lineHeight: 22.4 }}>
      {children}
    </T>
  );
}

const styles = {
  heading: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.yellow,
    borderBottomWidth: 2.5,
    borderColor: C.ink,
  },
};
