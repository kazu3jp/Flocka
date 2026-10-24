import { useAction } from "../sync/use-action";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
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
import { useSheetFeedback } from "../../components/feedback";
import { PopIn } from "../../components/motion";
import { useApp } from "../../store";
import { hapticSuccess } from "../haptics/haptics";

/** The headline after opening; skipping is neither a hit nor a miss. */
function openingResult(guess: string | null, card: string, self: boolean) {
  if (!guess || guess === "skip") return "開封！";
  if (guess === card) return "的中！";
  return self ? "予想外！" : "新発見！";
}

function GuessContent({ id }: { id: string }) {
  const { s, d, nav, api, refresh, toast, setOpening, peers } = useApp(),
    { busy, error, run } = useAction(),
    p = allPieces(s).find((p) => p.id === id),
    [wasConfirmed] = useState(p ? d.cards[p.card].confirmed : false),
    [guess, setGuess] = useState<string | null>(null),
    // The option being saved, shown as chosen before the server answers.
    [pending, setPending] = useState<string | null>(null),
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
  const became = !!after?.confirmed && !wasConfirmed,
    hit = !!p && guess === p.card;
  // Celebrate only results the server saved: a correct guess or a new confirmed card.
  useEffect(() => {
    if (stage === "open" && (hit || became)) hapticSuccess();
    // Runs once when the result appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  // Moderation, a block or a sync can remove the testimony while it is open.
  if (!p || !after)
    return (
      <Board safeTop safeBottom>
        <Header title="予想チャレンジ" />
        <T>この証言は表示できなくなりました。</T>
        <View style={S.fill} />
        <Btn label="閉じる" onPress={() => setOpening(null)} />
      </Board>
    );
  const opts = optionsFor(p, s.self),
    remaining = d.unopened.filter((piece) => piece.id !== p.id),
    chosen = busy ? pending : stage === "opening" ? guess : null,
    locked = busy || stage !== "guess";
  const choose = (k: string) => {
    if (locked) return;
    setPending(k);
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
                <View
                  key={k}
                  accessibilityState={{
                    selected: chosen === k,
                    disabled: locked,
                    busy: busy && chosen === k,
                  }}
                  style={{
                    flex: 1,
                    height: 220,
                    opacity: chosen && chosen !== k ? 0.4 : 1,
                    transform: [{ translateY: chosen === k ? -6 : 0 }],
                  }}
                >
                  <StrengthCard
                    card={bareCard(k, s.self.includes(k))}
                    style={{ flex: 1 }}
                    onPress={locked ? undefined : () => choose(k)}
                  />
                  {chosen === k && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: -4,
                        right: -4,
                        top: -4,
                        bottom: -4,
                        borderWidth: 3,
                        borderColor: C.yellow,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {busy && <ActivityIndicator color={C.yellow} />}
                    </View>
                  )}
                </View>
              ))}
            </View>
            <LinkButton
              label={
                busy && pending === "skip"
                  ? "開けています…"
                  : "予想せずに開ける"
              }
              disabled={locked}
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
              <PopIn>
                <T
                  display
                  size={28}
                  color={C.yellow}
                  style={{ transform: [{ rotate: "-7deg" }] }}
                >
                  {openingResult(guess, p.card, s.self.includes(p.card))}
                </T>
              </PopIn>
              {guess && guess !== p.card && Object.hasOwn(CARDS, guess) && (
                <T size={13}>予想：{CARDS[guess].name}</T>
              )}
            </View>
            <StrengthCard
              large
              card={after}
              style={{ height: 300, width: 230, alignSelf: "center" }}
            />
            {became ? (
              <PopIn>
                <T display size={18} style={{ textAlign: "center" }}>
                  2人目の証言で、確認済みに！
                </T>
              </PopIn>
            ) : (
              <T display size={18} style={{ textAlign: "center" }}>
                {`「${CARDS[p.card].name}」に証言+1`}
              </T>
            )}
          </>
        )}
      </ScrollView>
      {stage === "open" && remaining.length > 0 && (
        <Btn
          label={`次の封筒を開ける（残り${remaining.length}通）`}
          onPress={() => {
            if (became)
              toast("確認済みカード誕生！自己PRが書けます", {
                label: "見る",
                fn: () => nav.goTab("pr"),
              });
            setOpening(remaining[0].id);
          }}
        />
      )}
      {stage === "open" && (
        <Btn
          plain={remaining.length > 0}
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
  // Toasts raised while the overlay is open render inside its native window.
  const { content: feedback, register } = useSheetFeedback();
  useEffect(() => (opening ? register?.() : undefined), [opening, register]);
  return (
    <Modal
      visible={!!opening}
      animationType="fade"
      onRequestClose={() => setOpening(null)}
    >
      {opening && <GuessContent id={opening} key={opening} />}
      {opening && feedback}
    </Modal>
  );
}
