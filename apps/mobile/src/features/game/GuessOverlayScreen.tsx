import { useAction } from "../sync/use-action";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import {
  Board,
  Btn,
  C,
  Header,
  Icon,
  InlineError,
  LAYOUT,
  LinkButton,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";
import {
  CARDS,
  allPieces,
  derive,
  openPiece,
  optionsFor,
  wordsOf,
  type State,
} from "@flocka/domain";
import { useSheetFeedback } from "../../components/feedback";
import { useAppWidth, useModalFrame } from "../../components/app-frame";
import { cardHeightInRow } from "../../components/responsive-scale";
import { useReduceMotion } from "../../components/motion";
import { GuessEnvelope } from "./GuessEnvelope";
import { GuessReveal } from "./GuessReveal";
import { GuessOption } from "./GuessOption";
import { useApp } from "../../store";
import { useOpenTestimony } from "./use-open-testimony";
import { hapticSelection, hapticSuccess } from "../haptics/haptics";

/** The true card and two wrong ones (optionsFor), side by side. */
const GUESS_OPTION_COUNT = 3;
const GUESS_OPTION_GAP = 8;

/** Skipping is neither a hit nor a miss. */
function openingResult(guess: string | null, card: string, self: boolean) {
  if (!guess || guess === "skip") return "開封！";
  if (guess === card) return "的中！";
  return self ? "予想外！" : "新発見！";
}

function GuessContent({ id }: { id: string }) {
  const { s, d, nav, toast, setOpening, peers } = useApp(),
    openTestimony = useOpenTestimony(),
    { busy, error, run } = useAction(),
    p = allPieces(s).find((p) => p.id === id),
    [wasConfirmed] = useState(p ? d.cards[p.card].confirmed : false),
    [guess, setGuess] = useState<string | null>(null),
    // The option being saved, shown as chosen before the server answers.
    [pending, setPending] = useState<string | null>(null),
    [stage, setStage] = useState<"guess" | "opening" | "open">("guess"),
    reduced = useReduceMotion(),
    mounted = useRef(true),
    choosing = useRef(false);
  const reveal = useCallback(() => setStage("open"), []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
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
  const appWidth = useAppWidth();
  const optionHeight = cardHeightInRow(
    appWidth - 2 * LAYOUT.screenPadding,
    GUESS_OPTION_COUNT,
    GUESS_OPTION_GAP,
    220,
  );
  const became = !!after?.confirmed && !wasConfirmed,
    hit = !!p && guess === p.card;
  // Celebrate saved hits, new discoveries and newly confirmed cards.
  useEffect(() => {
    if (
      stage === "open" &&
      (hit || became || (p && !s.self.includes(p.card) && guess !== "skip"))
    )
      hapticSuccess();
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
    if (locked || choosing.current) return;
    choosing.current = true;
    setPending(k);
    hapticSelection();
    void run(async () => {
      const saved = await openTestimony(p.id, k);
      if (!mounted.current) return;
      setGuess(saved.guess ?? "skip");
      setStage(reduced ? "open" : "opening");
    }).finally(() => {
      choosing.current = false;
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
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
        style={S.fill}
      >
        {stage !== "open" ? (
          <>
            <GuessEnvelope
              size={Math.min(280, (appWidth - 2 * LAYOUT.screenPadding) * 0.78)}
              from={peers[p.fromId]?.profile.name ?? "相手"}
              opening={stage === "opening"}
              reduced={reduced}
              onOpened={reveal}
            />
            <T display size={24} style={{ textAlign: "center" }}>
              {peers[p.fromId]?.profile.name ?? "相手"}の
              {p.kind === "vibe" ? "印象" : "メモ"}は、
              {"\n"}どのカードの証言？
            </T>
            <View style={[S.row, { gap: GUESS_OPTION_GAP }]}>
              {opts.map((k) => (
                <GuessOption
                  key={k}
                  cardKey={k}
                  self={s.self.includes(k)}
                  chosen={chosen === k}
                  hasChoice={Boolean(chosen)}
                  busy={busy}
                  locked={locked}
                  height={optionHeight}
                  reduced={reduced}
                  onPress={() => choose(k)}
                />
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
            <GuessReveal variant="note" reduced={reduced}>
              <Panel>
                <T size={12} color={C.muted}>
                  {peers[p.fromId]?.profile.name ?? "相手"}より ·{" "}
                  {p.kind === "vibe" ? "第一印象" : "エピソード"}
                </T>
                <T display size={20} color={C.ink}>
                  「{wordsOf(p)}」
                </T>
                {p.label ? (
                  <T color={C.muted} size={13}>
                    要約：{p.label}
                  </T>
                ) : null}
              </Panel>
            </GuessReveal>
            <View style={[S.row, { justifyContent: "center", gap: 14 }]}>
              <GuessReveal
                variant="stamp"
                reduced={reduced}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderWidth: 3.5,
                  borderRadius: 10,
                  borderColor: hit ? C.dark : C.stampInk,
                  backgroundColor: C.paper,
                }}
              >
                <T
                  display
                  size={22}
                  color={hit ? C.dark : C.stampInk}
                  accessibilityLiveRegion="polite"
                >
                  {openingResult(guess, p.card, s.self.includes(p.card))}
                </T>
              </GuessReveal>
              {guess && guess !== p.card && Object.hasOwn(CARDS, guess) ? (
                <T size={13}>予想：{CARDS[guess].name}</T>
              ) : null}
            </View>
            <GuessReveal
              variant="card"
              reduced={reduced}
              style={{ height: 300, width: 230, alignSelf: "center" }}
            >
              <StrengthCard large card={after} style={{ flex: 1 }} />
            </GuessReveal>
            <GuessReveal variant="gain" reduced={reduced}>
              {became ? (
                <View>
                  <T display size={18} style={{ textAlign: "center" }}>
                    2人目の証言で、確認済みに！
                  </T>
                </View>
              ) : (
                <T display size={18} style={{ textAlign: "center" }}>
                  {`「${CARDS[p.card].name}」に証言+1`}
                </T>
              )}
            </GuessReveal>
          </>
        )}
      </ScrollView>
      <InlineError text={error} />
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
  const frame = useModalFrame();
  // Toasts raised while the overlay is open render inside its native window.
  const { content: feedback, register } = useSheetFeedback();
  useEffect(() => (opening ? register?.() : undefined), [opening, register]);
  return (
    <Modal
      visible={!!opening}
      transparent={!!frame}
      animationType="fade"
      onRequestClose={() => setOpening(null)}
    >
      {/* The web preview and a tablet show the challenge inside the app's column. */}
      <View
        style={[
          S.fill,
          frame && {
            position: "absolute",
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
            borderRadius: frame.borderRadius,
            overflow: "hidden",
          },
        ]}
      >
        {opening ? <GuessContent id={opening} key={opening} /> : null}
        {opening ? feedback : null}
      </View>
    </Modal>
  );
}
