import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { setStringAsync } from "expo-clipboard";
import { SvgXml } from "react-native-svg";
import vectors from "./vectors.json";
import {
  Avatar,
  Board,
  Btn,
  C,
  Choice,
  Envelope,
  Field,
  Header,
  Icon,
  LinkButton,
  LockedCard,
  Panel,
  S,
  StrengthCard,
  T,
} from "./components/ui";
import { useConfirmation } from "./components/pickers";
import {
  CARDS,
  DECO,
  DECO_COLORS,
  PEOPLE,
  allPieces,
  bareCard,
  buildPR,
  defaultDeco,
  derive,
  openPiece,
  optionsFor,
  wordsOf,
  type DecoData,
  type State,
} from "./model";
import { useApp } from "./store";

export function Deck() {
  const { s, d, nav, setOpening } = useApp(),
    { height, fontScale } = useWindowDimensions();
  const slots = [
    ...d.deck.slice(0, 6),
    ...Array(Math.max(0, 6 - d.deck.length)).fill(null),
  ];
  const unsent = s.connections.filter(
    (c) => c.status === "accepted" && !c.vibe && !s.blocked.includes(c.peerId),
  );
  const challenge = !!d.unopened.length,
    quest = challenge || !!unsent.length || !d.pieces.length;
  const goQuest = () =>
    challenge
      ? setOpening(d.unopened[0].id)
      : unsent.length
        ? nav.goTab("exchange", { id: "connections" })
        : nav.goTab("exchange");
  const small = height < 740 || fontScale > 1.2;
  const grid = (
    <View style={{ flex: small ? undefined : 1, gap: 10 }}>
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          style={{
            flex: small ? undefined : 1,
            height: small ? 200 : undefined,
            flexDirection: "row",
            gap: 10,
          }}
        >
          {slots
            .slice(row * 2, row * 2 + 2)
            .map((c, i) =>
              c ? (
                <StrengthCard
                  key={c.key}
                  card={c}
                  style={S.fill}
                  onPress={() => nav.push("card", { key: c.key })}
                />
              ) : (
                <LockedCard key={i} style={S.fill} />
              ),
            )}
        </View>
      ))}
    </View>
  );
  return (
    <Board>
      <View style={[S.row, { minHeight: 48 }]}>
        <Pressable
          accessibilityLabel="自分のページ"
          accessibilityRole="button"
          onPress={() => nav.push("me")}
        >
          <Avatar name={s.profile.name} avatar={s.profile.avatar} />
        </Pressable>
        <View style={S.fill}>
          <T display size={19}>
            {s.profile.name}
          </T>
          <T size={12} color={C.pale}>
            強みカード {d.deck.length}枚
          </T>
        </View>
        <LinkButton
          label="印象を贈る"
          onPress={() =>
            nav.goTab(
              "exchange",
              s.connections.some((c) => c.status === "accepted")
                ? { id: "connections" }
                : undefined,
            )
          }
        />
      </View>
      {quest && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            challenge
              ? "予想チャレンジ！"
              : unsent.length
                ? "交換した人に印象を贈ろう"
                : "まずは交換しよう"
          }
          onPress={goQuest}
        >
          <Panel style={[S.row, { padding: 10, backgroundColor: C.yellow }]}>
            <Envelope size={44} />
            <View style={S.fill}>
              <T display size={16} color={C.ink}>
                {challenge
                  ? "予想チャレンジ！"
                  : unsent.length
                    ? "交換した人に印象を贈ろう"
                    : "まずは交換しよう"}
              </T>
              <T size={11} color={C.ink}>
                {challenge
                  ? `封筒${d.unopened.length}通・どのカードか当てよう`
                  : unsent.length
                    ? `まだ印象を贈っていない人が${unsent.length}人`
                    : "会った人と、カードを交換"}
              </T>
            </View>
            <T
              display
              size={13}
              color={C.yellow}
              style={{ backgroundColor: C.ink, borderRadius: 10, padding: 8 }}
            >
              {challenge ? "開ける" : unsent.length ? "贈る" : "交換"}
            </T>
          </Panel>
        </Pressable>
      )}
      {small ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 4 }} style={S.fill}>
          {grid}
        </ScrollView>
      ) : (
        grid
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          d.prCard ? "自己PRが書けます！" : `自己PR あと証言${2 - d.best}人`
        }
        onPress={() => nav.goTab("pr")}
      >
        <Panel
          style={[
            S.row,
            { padding: 10, backgroundColor: d.prCard ? C.paper : C.ink },
          ]}
        >
          <View
            style={{
              width: 40,
              height: 48,
              backgroundColor: d.prCard ? C.yellow : C.paper,
              borderWidth: 2.5,
              borderColor: C.ink,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T display color={C.ink}>
              PR
            </T>
          </View>
          <View style={S.fill}>
            <T display size={16} color={d.prCard ? C.ink : C.white}>
              {d.prCard
                ? "自己PRが書けます！"
                : `自己PR　あと証言${2 - d.best}人`}
            </T>
            {d.prCard ? (
              <T size={11} color={C.muted}>
                「{d.prCard.name}」から下書きを生成
              </T>
            ) : (
              <View style={[S.row, { gap: 4, marginTop: 4 }]}>
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 26,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: i < d.best ? C.yellow : C.light,
                    }}
                  />
                ))}
              </View>
            )}
          </View>
          <Icon name="chev" color={d.prCard ? C.ink : C.white} />
        </Panel>
      </Pressable>
    </Board>
  );
}
function GuessContent({ id }: { id: string }) {
  const { s, d, nav, update, toast, setOpening } = useApp(),
    p = allPieces(s).find((p) => p.id === id),
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
  if (!p) return null;
  const opts = optionsFor(p, s.self),
    preview = JSON.parse(JSON.stringify(s)) as State;
  openPiece(preview, p.id, guess || "skip");
  const after = derive(preview).cards[p.card],
    became = after.confirmed && !d.cards[p.card].confirmed;
  const choose = (k: string) => {
    if (stage !== "guess") return;
    setGuess(k);
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
                {PEOPLE[p.fromId].name}より
              </T>
            </Animated.View>
            <T display size={24} style={{ textAlign: "center" }}>
              {PEOPLE[p.fromId].name}の{p.kind === "vibe" ? "印象" : "メモ"}は、
              {"\n"}どのカードの証言？
            </T>
            <View style={[S.row, { gap: 8 }]}>
              {opts.map((k) => (
                <StrengthCard
                  key={k}
                  card={bareCard(k, s.self.includes(k))}
                  style={{ flex: 1, height: 220 }}
                  onPress={() => choose(k)}
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
                {PEOPLE[p.fromId].name}より ·{" "}
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
            update((x) => openPiece(x, p.id, guess || "skip"));
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
export function CardDetail({ cardKey }: { cardKey: string }) {
  const { s, d, nav, update } = useApp(),
    c = d.cards[cardKey];
  if (!c)
    return (
      <Board>
        <Header title="カード" onBack={nav.pop} />
        <T>カードが見つかりませんでした。</T>
      </Board>
    );
  return (
    <Board scroll>
      <Header title="カード詳細" onBack={nav.pop} />
      <StrengthCard
        card={c}
        large
        style={{ height: 340, width: 265, alignSelf: "center" }}
      />
      <Btn
        plain
        label="このカードをデコる"
        onPress={() => nav.push("deco", { key: cardKey })}
      />
      <Panel>
        <T color={C.ink}>
          {c.confirmed
            ? "異なる2人以上の証言で確認済みになりました。"
            : c.discovered
              ? "仲間の証言から見つかった、あなたの新しい一面です。"
              : c.testimonies.length
                ? "あと1人の証言で確認済みに。"
                : "自分が選んだ「自己申告」のカードです。"}
        </T>
      </Panel>
      {c.discovered && (
        <>
          <T display size={18}>
            この強み、どう感じる？
          </T>
          <View style={S.row}>
            {(
              [
                ["agree", "納得"],
                ["hold", "保留"],
                ["disagree", "違うかも"],
              ] as const
            ).map(([r, l]) => (
              <Choice
                key={r}
                selected={s.resp[cardKey] === r}
                label={l}
                onPress={() =>
                  update((x) => {
                    x.resp[cardKey] = r;
                  })
                }
              />
            ))}
          </View>
          <T size={12}>「違うかも」を選んだカードは自己PRに使いません。</T>
        </>
      )}
      <T display size={18}>
        仲間の証言 · {c.givers.length}人
      </T>
      {c.testimonies.map((p) => (
        <Pressable
          accessibilityRole="button"
          key={p.id}
          onPress={() => nav.push("piece", { id: p.id })}
        >
          <Panel>
            <T color={C.ink}>
              {PEOPLE[p.fromId].name} ·{" "}
              {p.guess === "skip"
                ? "予想なし"
                : p.guess === p.card
                  ? "的中"
                  : "予想外"}
            </T>
            <T color={C.muted} size={13}>
              「{wordsOf(p)}」
            </T>
          </Panel>
        </Pressable>
      ))}
    </Board>
  );
}
export function Deco({ cardKey }: { cardKey: string }) {
  const { s, d, nav, update, toast } = useApp(),
    [tab, setTab] = useState<"pattern" | "frame" | "stickers" | "color">(
      "pattern",
    );
  const c = d.cards[cardKey];
  if (!c)
    return (
      <Board>
        <Header title="カードをデコる" onBack={nav.pop} />
      </Board>
    );
  const cur = s.deco[cardKey] || defaultDeco(),
    set = (patch: Partial<DecoData>) =>
      update((x) => {
        x.deco[cardKey] = { ...cur, ...patch };
      });
  const select = (key: string) => {
    if (tab !== "stickers") {
      set({ [tab]: key });
      return;
    }
    if (cur.stickers.includes(key)) {
      set({ stickers: cur.stickers.filter((v) => v !== key) });
      return;
    }
    if (cur.stickers.length >= 4) {
      toast("シールは4枚まで。貼っているシールを外すと追加できます");
      return;
    }
    const used = cur.stickers.map(
      (k, i) => cur.layout?.[k]?.position || ["br", "bl", "tr", "tl"][i],
    );
    set({
      stickers: [...cur.stickers, key],
      layout: {
        ...cur.layout,
        [key]: {
          position:
            ["br", "bl", "tr", "tl"].find((p) => !used.includes(p)) || "br",
          size: 23,
          angle: 12,
        },
      },
    });
  };
  return (
    <Board>
      <Header
        title="カードをデコる"
        onBack={nav.pop}
        right={
          <LinkButton
            label="元に戻す"
            onPress={() =>
              update((x) => {
                delete x.deco[cardKey];
              })
            }
          />
        }
      />
      <StrengthCard
        card={{ ...c, deco: cur }}
        large
        style={{ height: 285, width: 222, alignSelf: "center" }}
      />
      <View style={[S.row, { gap: 5 }]}>
        {(
          [
            ["pattern", "模様"],
            ["frame", "フレーム"],
            ["stickers", "シール"],
            ["color", "色"],
          ] as const
        ).map(([k, l]) => (
          <View key={k} style={S.fill}>
            <Choice label={l} selected={tab === k} onPress={() => setTab(k)} />
          </View>
        ))}
      </View>
      <T size={12}>
        {tab === "stickers"
          ? `4枚まで貼れます · 現在${cur.stickers.length}枚。もう一度タップすると外せます。`
          : "自由に組み合わせて、自分らしい1枚に。"}
      </T>
      <ScrollView style={S.fill} contentContainerStyle={{ paddingBottom: 6 }}>
        <View style={S.wrap}>
          {(tab === "color" ? DECO_COLORS : DECO[tab]).map(([k, l]) => (
            <View key={k} style={{ width: "31%" }}>
              <Choice
                label={l}
                selected={
                  tab === "stickers" ? cur.stickers.includes(k) : cur[tab] === k
                }
                onPress={() => select(k)}
              >
                <View style={{ alignItems: "center", gap: 4 }}>
                  {tab === "stickers" ? (
                    <SvgXml
                      xml={(vectors.stickers as Record<string, string>)[k]}
                      width={38}
                      height={38}
                    />
                  ) : (
                    <StrengthCard
                      card={{
                        ...bareCard(cardKey),
                        deco: { ...cur, [tab]: k, stickers: [] },
                      }}
                      style={{ height: 80, width: 56 }}
                    />
                  )}
                  <T color={C.ink} size={12}>
                    {l}
                  </T>
                </View>
              </Choice>
            </View>
          ))}
        </View>
      </ScrollView>
      <Btn
        label="完了"
        onPress={() => {
          toast("デコを保存しました");
          nav.pop();
        }}
      />
    </Board>
  );
}
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
