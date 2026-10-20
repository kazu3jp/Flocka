import { useAction } from "../sync/use-action";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import {
  Board,
  Btn,
  C,
  Envelope,
  Header,
  Icon,
  LinkButton,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";
import {
  CARDS,
  allPieces,
  bareCard,
  derive,
  openPiece,
  optionsFor,
  wordsOf,
  type State,
} from "@flocka/domain";
import { useApp } from "../../store";
function GuessContent({ id }: { id: string }) {
  const { s, d, nav, api, refresh, toast, setOpening, peers } = useApp(),
    { busy, error, run } = useAction(),
    p = allPieces(s).find((p) => p.id === id),
    [wasConfirmed] = useState(p ? d.cards[p.card].confirmed : false),
    [guess, setGuess] = useState<string | null>(null),
    [stage, setStage] = useState<"guess" | "opening" | "open">("guess"),
    [reduced, setReduced] = useState(false),
    [scale] = useState(() => new Animated.Value(1)),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduced(v);
    });
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      listener.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  // Opening animation re-renders often; the projected card only depends on state and guess.
  const after = useMemo(() => {
    if (!p) return null;
    const preview = JSON.parse(JSON.stringify(s)) as State;
    openPiece(preview, p.id, guess || "skip");
    return derive(preview).cards[p.card];
    // p is re-found on each render; its id and card identify it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, p?.id, p?.card, guess]);
  if (!p || !after) return null;
  const opts = optionsFor(p, s.self),
    became = after.confirmed && !wasConfirmed;
  const choose = (k: string) => {
    if (stage !== "guess") return;
    void run(async () => {
      const saved = await api.openTestimony(p.id, k);
      await refresh();
      setGuess(saved.guess ?? "skip");
      if (reduced) {
        setStage("open");
        return;
      }
      setStage("opening");
      Animated.timing(scale, {
        toValue: 1.08,
        duration: 450,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => setStage("open"), 450);
    });
  };
  return (
    <Board safeTop safeBottom>
      <Header
        title="予想チャレンジ"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="あとで開ける"
            onPress={() => setOpening(null)}
            style={{ padding: 12 }}
          >
            <Icon name="x" />
          </Pressable>
        }
      />
      {error && (
        <T accessibilityRole="alert" color={C.yellow}>
          {error}
        </T>
      )}
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
        style={S.fill}
      >
        {stage !== "open" ? (
          <>
            <Animated.View
              style={{
                alignItems: "center",
                paddingTop: 12,
                transform: [{ scale }],
              }}
            >
              <Envelope size={250} />
              <T
                display
                size={16}
                color={C.ink}
                style={{ marginTop: -48, marginBottom: 30 }}
              >
                {peers[p.fromId]?.profile.name ?? "プロフィールを取得中"}より
              </T>
            </Animated.View>
            <T display size={24} style={{ textAlign: "center" }}>
              {peers[p.fromId]?.profile.name ?? "プロフィールを取得中"}の
              {p.kind === "vibe" ? "印象" : "メモ"}は、
              {"\n"}どのカードの証言？
            </T>
            <View style={[S.row, { gap: 8 }]}>
              {opts.map((k) => (
                <StrengthCard
                  key={k}
                  card={bareCard(k, s.self.includes(k))}
                  style={{ flex: 1, height: 220 }}
                  onPress={() => {
                    if (!busy) choose(k);
                  }}
                />
              ))}
            </View>
            <LinkButton
              label="予想せずに開ける"
              onPress={() => choose("skip")}
            />
          </>
        ) : (
          <>
            <Panel>
              <T size={12} color={C.muted}>
                {peers[p.fromId]?.profile.name ?? "プロフィールを取得中"}より ·{" "}
                {p.kind === "vibe" ? "会話の印象" : "見た場面"}
              </T>
              <T display size={20} color={C.ink}>
                「{wordsOf(p)}」
              </T>
              {p.label && (
                <T color={C.muted} size={13}>
                  要約：{p.label}
                </T>
              )}
            </Panel>
            <View style={[S.row, { justifyContent: "center" }]}>
              <T
                display
                size={28}
                color={C.yellow}
                style={{ transform: [{ rotate: "-7deg" }] }}
              >
                {guess === p.card
                  ? "的中！"
                  : s.self.includes(p.card)
                    ? "予想外！"
                    : "新発見！"}
              </T>
              {guess && guess !== "skip" && guess !== p.card && (
                <T size={13}>予想：{CARDS[guess].name}</T>
              )}
            </View>
            <StrengthCard
              large
              card={after}
              style={{ height: 300, width: 230, alignSelf: "center" }}
            />
            <T display size={18} style={{ textAlign: "center" }}>
              {became
                ? "2人目の証言で、確認済みに！"
                : `「${CARDS[p.card].name}」に証言+1`}
            </T>
          </>
        )}
      </ScrollView>
      {stage === "open" && (
        <Btn
          label="デッキに加える"
          onPress={() => {
            setOpening(null);
            nav.goTab("find", undefined, true);
            if (became)
              toast("確認済みカード誕生！自己PRが書けます", {
                label: "見る",
                fn: () => nav.goTab("pr"),
              });
          }}
        />
      )}
    </Board>
  );
}

export function GuessOverlay() {
  const { opening, setOpening } = useApp();
  return (
    <Modal
      visible={!!opening}
      animationType="fade"
      onRequestClose={() => setOpening(null)}
    >
      {opening && <GuessContent id={opening} key={opening} />}
    </Modal>
  );
}
