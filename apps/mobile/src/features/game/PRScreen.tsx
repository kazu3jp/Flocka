import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, View } from "react-native";
import { setStringAsync } from "expo-clipboard";
import {
  Avatar,
  Board,
  Btn,
  C,
  Field,
  Header,
  Icon,
  Panel,
  S,
  T,
} from "../../components/ui";
import { useConfirmation } from "../../components/pickers";
import { PEOPLE, buildPR } from "@flocka/domain";
import { useApp } from "../../store";

export function PR() {
  const { s, d, nav, update, toast, setOpening } = useApp(),
    pr = buildPR(s),
    draft = s.prDraft ?? pr?.text ?? "",
    [shown, setShown] = useState(0),
    [edit, setEdit] = useState(false),
    { ask, dialog } = useConfirmation();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active) return;
      if (reduced || s.prDraft !== null) {
        setShown(draft.length);
        return;
      }
      setShown(0);
      timer = setInterval(
        () =>
          setShown((n) => {
            const next = Math.min(draft.length, n + 2);
            if (next === draft.length && timer) clearInterval(timer);
            return next;
          }),
        22,
      );
    });
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [draft, s.prDraft]);
  if (!pr)
    return (
      <Board>
        <Header title="自己PR" />
        <Panel style={S.gap}>
          <View style={S.row}>
            <Icon name="lock" color={C.ink} />
            <T display color={C.ink}>
              まだ書けません
            </T>
          </View>
          <T color={C.ink}>
            同じ強みに2人以上の証言がそろうと「確認済みカード」になり、その証言だけで自己PRの下書きが書き上がります。
          </T>
          <T color={C.ink}>いちばん多いカード：証言{d.best}/2</T>
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
      <Header title="自己PR" right={<T size={12}>約 {draft.length} 字</T>} />
      <Panel style={{ flex: 1, padding: 0, overflow: "hidden" }}>
        <View
          style={[
            S.row,
            {
              padding: 12,
              backgroundColor: C.yellow,
              borderBottomWidth: 2.5,
              borderColor: C.ink,
            },
          ]}
        >
          <T color={C.ink} display size={14} style={S.fill}>
            強み：{pr.card.name}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="もう一度書き出す"
            onPress={() =>
              ask(
                "もう一度書き出す？",
                "手で編集した内容を消して、現在の証言から下書きを作ります。",
                () => {
                  update((x) => {
                    x.prDraft = null;
                  });
                  setEdit(false);
                  setShown(0);
                },
                "書き出す",
              )
            }
            style={{ padding: 8 }}
          >
            <Icon name="redo" color={C.ink} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
          style={S.fill}
        >
          {edit ? (
            <Field
              label="自己PRを編集"
              multiline
              value={draft}
              onChangeText={(prDraft) =>
                update((x) => {
                  x.prDraft = prDraft;
                })
              }
              style={{ minHeight: 350 }}
            />
          ) : (
            <Pressable
              accessibilityLabel="自己PRの全文を表示"
              onPress={() => setShown(draft.length)}
            >
              <T color={C.ink} size={16} selectable>
                {draft.slice(0, shown)}
                {shown < draft.length ? "▍" : ""}
              </T>
            </Pressable>
          )}
        </ScrollView>
        <View style={[S.row, { padding: 14 }]}>
          {pr.sources.map((id) => (
            <Avatar
              key={id}
              name={PEOPLE[id].name}
              avatar={{ type: "motif", motif: "cat", color: C.pink }}
              size={24}
            />
          ))}
          <T color={C.muted} size={12}>
            仲間{pr.sources.length}人の証言から作成
          </T>
        </View>
      </Panel>
      <T size={12} style={{ textAlign: "center" }}>
        仲間の実際の言葉だけで組み立てた下書きです。経験や成果は足していません。
      </T>
      <View style={S.row}>
        <Btn
          style={S.fill}
          plain
          label={edit ? "完了" : "書き直す"}
          icon="edit"
          onPress={() => {
            setShown(draft.length);
            setEdit(!edit);
          }}
        />
        <Btn
          style={S.fill}
          label="コピー"
          icon="copy"
          onPress={() => {
            setStringAsync(draft)
              .then((ok) =>
                toast(ok ? "コピーしました" : "コピーできませんでした"),
              )
              .catch(() => toast("コピーできませんでした"));
          }}
        />
      </View>
      {dialog}
    </Board>
  );
}
