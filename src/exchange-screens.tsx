import React, { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "expo-router";
import QRCode from "react-native-qrcode-svg";
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
  Panel,
  S,
  Sheet,
  StrengthCard,
  T,
} from "./components/ui";
import { useConfirmation } from "./components/pickers";
import {
  CARDS,
  PEOPLE,
  PEER_PROFILE,
  VIBES,
  VIBE_CARD,
  approveExchange,
  bareCard,
  now,
  parseDemoQR,
  startExchange,
  summarize,
  type Card,
} from "./model";
import { useApp } from "./store";

function PeerAvatar({ id, size = 44 }: { id: string; size?: number }) {
  return (
    <Avatar
      name={PEOPLE[id]?.name}
      size={size}
      avatar={{ type: "motif", ...PEER_PROFILE[id]?.avatar }}
    />
  );
}
function Player({ peerId, onPick }: { peerId?: string; onPick?: () => void }) {
  const { s, d } = useApp(),
    peer = peerId ? PEER_PROFILE[peerId] : null;
  const chosen = s.showcase
    .map((k) => d.deck.find((c) => c.key === k))
    .filter((c): c is Card => !!c);
  const cards = peer
    ? peer.cards.map(([k, n]) => ({
        ...bareCard(k),
        givers: Array(n).fill("peer"),
        confirmed: n >= 2,
      }))
    : chosen.length
      ? chosen
      : d.deck.slice(0, 3);
  const interests = peer ? peer.interests : s.profile.interests;
  return (
    <Panel style={{ flex: 1, padding: 0, overflow: "hidden", minHeight: 330 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: C.ink,
        }}
      >
        <T size={12}>プレイヤーカード</T>
      </View>
      <View style={[S.row, { padding: 16, paddingBottom: 4 }]}>
        {peerId ? (
          <PeerAvatar id={peerId} size={60} />
        ) : (
          <Avatar name={s.profile.name} avatar={s.profile.avatar} size={64} />
        )}
        <T display size={26} color={C.ink} style={S.fill}>
          {peerId ? PEOPLE[peerId].name : s.profile.name}
        </T>
      </View>
      <T size={13} color={C.muted} style={{ paddingHorizontal: 16 }}>
        {peerId ? PEOPLE[peerId].role : s.profile.role}
      </T>
      <View style={[S.row, { paddingHorizontal: 16 }]}>
        <T size={12} color={C.ink} style={S.fill}>
          強み
        </T>
        {onPick && <LinkButton label="選ぶ" color={C.ink} onPress={onPick} />}
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        {cards.map((c, i) => (
          <StrengthCard
            key={c.key}
            card={c}
            style={{
              width: cards.length === 3 ? "36%" : "46%",
              height: "95%",
              minHeight: 190,
              marginLeft: i ? -9 : 0,
              transform: [{ rotate: `${(i - (cards.length - 1) / 2) * 8}deg` }],
            }}
          />
        ))}
      </View>
      <View
        style={{
          padding: 14,
          paddingTop: 6,
          borderTopWidth: 1,
          borderColor: C.grey,
        }}
      >
        <T color={C.muted} size={11}>
          関心
        </T>
        <T color={C.ink} size={12}>
          {interests.map((i) => "#" + i).join("　")}
        </T>
      </View>
    </Panel>
  );
}
export function Exchange() {
  const { s, d, nav, update, toast } = useApp(),
    [pick, setPick] = useState(false);
  const chosen = s.showcase.length
    ? s.showcase
    : d.deck.slice(0, 3).map((c) => c.key);
  const toggle = (k: string) => {
    if (chosen.includes(k))
      update((x) => {
        x.showcase = chosen.filter((v) => v !== k);
      });
    else if (chosen.length >= 3) toast("3枚まで選べます");
    else
      update((x) => {
        x.showcase = [...chosen, k];
      });
  };
  return (
    <Board>
      <Header
        title="交換"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="つながった人"
            onPress={() => nav.push("connections")}
            style={{ padding: 12 }}
          >
            <Icon name="users" />
          </Pressable>
        }
      />
      <Player onPick={() => setPick(true)} />
      <Btn
        label="近くの人と交換"
        icon="swap"
        onPress={() => nav.push("nearby")}
      />
      <Btn plain label="QRで交換" icon="qr" onPress={() => nav.push("scan")} />
      {s.connections.some(
        (c) =>
          c.status === "accepted" && !c.vibe && !s.blocked.includes(c.peerId),
      ) && (
        <Btn
          plain
          small
          label="交換した人に印象を贈る"
          onPress={() => nav.push("connections")}
        />
      )}
      <T size={11} style={{ textAlign: "center" }}>
        ローカルデモ · 相手への通信は未接続
      </T>
      {pick && (
        <Sheet
          title="相手に見せる強み（3枚まで）"
          onClose={() => setPick(false)}
        >
          <View style={S.wrap}>
            {d.deck.map((c) => (
              <Choice
                key={c.key}
                label={c.name}
                selected={chosen.includes(c.key)}
                onPress={() => toggle(c.key)}
              />
            ))}
          </View>
          <Btn label="決定" onPress={() => setPick(false)} />
        </Sheet>
      )}
    </Board>
  );
}
export function Nearby() {
  const { s, nav, update } = useApp(),
    peers = Object.keys(PEOPLE).filter((id) => !s.blocked.includes(id));
  const start = (peerId: string) => {
    const id = update((x) => startExchange(x, peerId));
    if (id) nav.replace("confirm", { cid: id });
  };
  return (
    <Board scroll>
      <Header title="近くの人と交換" onBack={nav.pop} />
      <View style={{ alignItems: "center", padding: 14 }}>
        <Icon name="radar" size={60} />
      </View>
      <T size={13}>
        元プロトタイプのデモの3人です。近距離通信による検出は未接続です。
      </T>
      {peers.length ? (
        peers.map((id) => (
          <Pressable
            accessibilityRole="button"
            key={id}
            onPress={() => start(id)}
          >
            <Panel style={S.row}>
              <PeerAvatar id={id} />
              <View style={S.fill}>
                <T display color={C.ink} size={17}>
                  {PEOPLE[id].name}
                </T>
                <T color={C.muted} size={12}>
                  {s.connections.some(
                    (c) => c.peerId === id && c.status === "accepted",
                  )
                    ? "交換済み・プロフィールを見る"
                    : PEOPLE[id].role}
                </T>
              </View>
              <Icon name="chev" color={C.ink} />
            </Panel>
          </Pressable>
        ))
      ) : (
        <T>
          近くに交換できる人がいません。ブロックした人は設定から解除できます。
        </T>
      )}
    </Board>
  );
}
export function Connections() {
  const { s, nav, update, toast } = useApp(),
    { ask, dialog } = useConfirmation(),
    connections = s.connections.filter(
      (c) => c.status !== "cancelled" && !s.blocked.includes(c.peerId),
    );
  return (
    <Board scroll>
      <Header title="つながった人" onBack={nav.pop} />
      {!connections.length && (
        <Panel>
          <T color={C.ink}>
            まだ交換した人はいません。交換画面から、近くの人やQRで交換できます。
          </T>
        </Panel>
      )}
      {connections.map((c) => (
        <Panel key={c.id} style={S.gap}>
          <View style={S.row}>
            <PeerAvatar id={c.peerId} />
            <View style={S.fill}>
              <T display color={C.ink} size={17}>
                {PEOPLE[c.peerId].name}
              </T>
              <T color={C.muted} size={12}>
                {c.status === "pending"
                  ? "承認待ち"
                  : c.vibe
                    ? "印象を贈りました"
                    : "印象はまだ贈っていません"}
              </T>
            </View>
          </View>
          <T color={C.muted} size={13}>
            {c.context.place} · {c.context.trigger}
          </T>
          <View style={S.row}>
            <Btn
              style={S.fill}
              small
              label={
                c.status === "pending" ? "確認" : c.vibe ? "詳細" : "印象を贈る"
              }
              onPress={() =>
                nav.push(
                  c.status === "pending" || c.vibe ? "confirm" : "give",
                  { cid: c.id },
                )
              }
            />
            <LinkButton
              color={C.ink}
              label="交換を解除"
              onPress={() =>
                ask(
                  "交換を解除する？",
                  "届いた証言は残ります。",
                  () => {
                    update((x) => {
                      const cc = x.connections.find((v) => v.id === c.id);
                      if (cc) cc.status = "cancelled";
                    });
                    toast("交換を解除しました");
                  },
                  "解除する",
                )
              }
            />
          </View>
        </Panel>
      ))}
      <Btn
        plain
        label="見た場面をメモで贈る"
        icon="doc"
        onPress={() => nav.push("memo")}
      />
      {dialog}
    </Board>
  );
}
export function Scan() {
  const { s, nav, update, toast } = useApp(),
    [mode, setMode] = useState<"show" | "scan">("show"),
    [examples, setExamples] = useState(false),
    [permission, requestPermission] = useCameraPermissions(),
    scanned = useRef(false),
    focused = useIsFocused();
  const receive = (data: string) => {
    if (scanned.current) return;
    const peerId = parseDemoQR(data);
    if (!peerId) {
      toast(
        "このデモ用のQRではありません。実際のユーザー交換はサーバー未接続です。",
      );
      scanned.current = true;
      return;
    }
    const id = update((x) => startExchange(x, peerId));
    if (!id) {
      toast("ブロックした人とは交換できません");
      scanned.current = true;
      return;
    }
    scanned.current = true;
    nav.replace("confirm", { cid: id });
  };
  return (
    <Board>
      <Header title="QRで交換" onBack={nav.pop} />
      <View style={S.row}>
        <View style={S.fill}>
          <Choice
            label="自分のQRを見せる"
            selected={mode === "show"}
            onPress={() => setMode("show")}
          />
        </View>
        <View style={S.fill}>
          <Choice
            label="相手のQRを読み取る"
            selected={mode === "scan"}
            onPress={() => {
              scanned.current = false;
              setMode("scan");
            }}
          />
        </View>
      </View>
      {mode === "show" ? (
        <>
          <View style={{ flex: 1, justifyContent: "center", gap: 20 }}>
            <Panel
              style={{ alignItems: "center", gap: 16, paddingVertical: 30 }}
            >
              <QRCode
                value={JSON.stringify({
                  type: "flocka-local-profile",
                  version: 1,
                  name: s.profile.name,
                  role: s.profile.role,
                  self: s.self,
                })}
                size={230}
                color={C.ink}
                backgroundColor={C.paper}
              />
              <Avatar
                name={s.profile.name}
                avatar={s.profile.avatar}
                size={56}
              />
              <T display color={C.ink} size={20}>
                {s.profile.name}
              </T>
            </Panel>
            <T size={12} style={{ textAlign: "center" }}>
              プロフィールのQRです。実際のユーザー同士の交換・承認にはサーバー接続が必要です。
            </T>
          </View>
        </>
      ) : (
        <>
          <View style={{ flex: 1, justifyContent: "center", gap: 14 }}>
            {permission?.granted && focused ? (
              <View
                style={{
                  height: 320,
                  borderWidth: 3,
                  borderColor: C.yellow,
                  borderRadius: 20,
                  overflow: "hidden",
                }}
              >
                <CameraView
                  style={S.fill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={({ data }) => receive(data)}
                />
              </View>
            ) : (
              <Panel style={S.gap}>
                <T color={C.ink}>QRの読み取りにカメラを使います。</T>
                <Btn
                  label="カメラを許可する"
                  onPress={() => {
                    requestPermission()
                      .then((p) => {
                        if (!p.granted)
                          toast(
                            "カメラが許可されていません。端末の設定で許可してください。",
                          );
                      })
                      .catch(() => toast("カメラを利用できませんでした"));
                  }}
                />
              </Panel>
            )}
            <Btn
              plain
              small
              label="もう一度読み取る"
              onPress={() => {
                scanned.current = false;
                toast("読み取りを再開しました");
              }}
            />
            <T size={12}>
              別端末に表示した体験用QRを読み取ると、元のデモ交換へ進みます。
            </T>
          </View>
        </>
      )}
      <LinkButton label="体験用QRを見る" onPress={() => setExamples(true)} />
      {examples && (
        <Sheet title="体験用の相手QR" onClose={() => setExamples(false)}>
          <T size={13}>別端末のこの画面をカメラで読み取ってください。</T>
          {Object.entries(PEOPLE).map(([id, p]) => (
            <Panel key={id} style={{ alignItems: "center", gap: 8 }}>
              <QRCode
                value={`flocka-demo://peer/${id}`}
                size={150}
                color={C.ink}
                backgroundColor={C.paper}
              />
              <T color={C.ink}>{p.name}</T>
            </Panel>
          ))}
        </Sheet>
      )}
    </Board>
  );
}
export function Confirm({ cid }: { cid: string }) {
  const { s, nav, update, toast } = useApp(),
    [memoOpen, setMemoOpen] = useState(false),
    c = s.connections.find((c) => c.id === cid);
  if (!c)
    return (
      <Board>
        <Header title="交換" onBack={nav.pop} />
        <T>交換が見つかりませんでした。</T>
      </Board>
    );
  const done = !!c.context.place.trim() && !!c.context.trigger.trim(),
    pending = c.status === "pending" && !c.myApproved;
  const approve = () => {
    if (!done) {
      setMemoOpen(true);
      return;
    }
    const accepted = update((x) => approveExchange(x, cid));
    if (accepted) {
      setMemoOpen(false);
      toast(`交換成立！${PEOPLE[c.peerId].name}とつながりました（デモ）`);
    }
  };
  const setContext = (key: "place" | "trigger", value: string) =>
    update((x) => {
      const cc = x.connections.find((v) => v.id === cid);
      if (cc) cc.context[key] = value;
    });
  return (
    <Board>
      <Header
        title="交換"
        onBack={nav.pop}
        right={
          <T size={12}>{c.status === "accepted" ? "交換成立" : "内容確認"}</T>
        }
      />
      <Player peerId={c.peerId} />
      {!pending && (
        <Panel style={{ padding: 10 }}>
          <T color={C.muted} size={12}>
            出会いのメモ
          </T>
          <T color={C.ink} size={13}>
            {c.context.place} · {c.context.trigger}
          </T>
          <LinkButton
            label="メモを編集"
            color={C.ink}
            onPress={() => setMemoOpen(true)}
          />
        </Panel>
      )}
      {c.status === "accepted" ? (
        <>
          <T size={14} style={{ textAlign: "center" }}>
            {PEOPLE[c.peerId].name}とつながりました！
          </T>
          <Btn
            label={c.vibe ? "交換へ戻る" : "印象を贈る"}
            onPress={() => (c.vibe ? nav.root() : nav.replace("give", { cid }))}
          />
          {!c.vibe && <LinkButton label="あとで贈る" onPress={nav.root} />}
        </>
      ) : c.status === "cancelled" ? (
        <Btn label="交換へ戻る" onPress={nav.root} />
      ) : (
        <>
          <Btn
            label={c.myApproved ? "相手の承認を待っています…" : "交換する"}
            disabled={c.myApproved}
            onPress={approve}
          />
          <LinkButton
            label="キャンセル"
            onPress={() => {
              update((x) => {
                const cc = x.connections.find((v) => v.id === cid);
                if (cc) cc.status = "cancelled";
              });
              toast("キャンセルしました");
              nav.pop();
            }}
          />
        </>
      )}
      {memoOpen && (
        <Sheet title="出会いのメモ" onClose={() => setMemoOpen(false)}>
          <T size={13}>
            どこで、何をきっかけに交換したか。交換するには両方の入力が必要です。あとから編集できます。
          </T>
          <Field
            label="場所・イベント名（必須）"
            maxLength={60}
            value={c.context.place}
            placeholder="例：学校のラウンジ、勉強会"
            onChangeText={(v) => setContext("place", v)}
          />
          <Field
            label="交換のきっかけ（必須）"
            maxLength={100}
            value={c.context.trigger}
            placeholder="例：同じチームで発表を準備した"
            onChangeText={(v) => setContext("trigger", v)}
          />
          <Btn
            label={pending ? "保存して交換する" : "保存する"}
            disabled={!done}
            onPress={() => (pending ? approve() : setMemoOpen(false))}
          />
          {!done && <T size={12}>2つの項目を入力すると進めます</T>}
        </Sheet>
      )}
    </Board>
  );
}
export function Give({ cid }: { cid: string }) {
  const { s, update, nav, toast } = useApp(),
    [mode, setMode] = useState<"pick" | "free">("pick"),
    [sel, setSel] = useState(""),
    [text, setText] = useState(""),
    [sum, setSum] = useState<{ card: string; label: string } | null>(null),
    c = s.connections.find((c) => c.id === cid);
  if (!c)
    return (
      <Board>
        <Header title="印象を贈る" onBack={nav.pop} />
        <T>交換が見つかりませんでした。</T>
      </Board>
    );
  const sent = s.sentVibes.find((v) => v.id === c.vibe),
    ready = mode === "pick" ? !!sel && !!text.trim() : text.trim().length >= 8;
  const send = () => {
    if (!ready) return;
    const content =
      mode === "pick"
        ? { card: VIBE_CARD[sel], label: sel }
        : sum || summarize(text);
    const accepted = update((x) => {
      const cc = x.connections.find((v) => v.id === cid);
      if (
        !cc ||
        cc.vibe ||
        cc.status !== "accepted" ||
        x.blocked.includes(cc.peerId)
      )
        return false;
      const id = "sv-" + Date.now();
      x.sentVibes.push({
        id,
        toId: cc.peerId,
        kind: "vibe",
        ...content,
        text: text.trim(),
        context: { ...cc.context },
        createdAt: now(),
      });
      cc.vibe = id;
      return true;
    });
    if (accepted) toast(`${PEOPLE[c.peerId].name}に印象を贈りました（デモ）`);
  };
  if (c.vibe)
    return (
      <Board scroll>
        <Header title="贈った印象" onBack={nav.pop} />
        <Panel style={S.gap}>
          <T color={C.muted} size={13}>
            そう感じた理由
          </T>
          <T display color={C.ink} size={22}>
            「{sent?.text}」
          </T>
          <T color={C.ink}>印象：{sent?.label}</T>
        </Panel>
        <Panel>
          <T color={C.muted} size={12}>
            交換した場所・きっかけ
          </T>
          <T color={C.ink}>
            {c.context.place}
            {"\n"}
            {c.context.trigger}
          </T>
        </Panel>
        <T display size={24} style={{ textAlign: "center" }}>
          {PEOPLE[c.peerId].name}に印象を贈りました
        </T>
        <T size={12}>
          端末内に贈った記録を保存しました。相手への通信は未接続です。
        </T>
        <Btn plain label="交換へ戻る" onPress={nav.root} />
      </Board>
    );
  return (
    <Board scroll>
      <Header
        title="印象を贈る"
        onBack={nav.pop}
        right={<PeerAvatar id={c.peerId} size={32} />}
      />
      <T display size={21}>
        相手のいいなと思ったところは？
      </T>
      <T size={13}>
        {mode === "pick"
          ? "言葉を1つ選び、そう感じた理由を添えて贈ってください。"
          : "どんな場面で、なぜそう感じたかを8文字以上で書いてください。"}
      </T>
      <Panel>
        <T color={C.muted} size={12}>
          交換のきっかけ
        </T>
        <T color={C.ink} size={14}>
          {c.context.place} ／ {c.context.trigger}
        </T>
        <LinkButton
          label="出会いのメモを編集"
          color={C.ink}
          onPress={() => nav.push("confirm", { cid })}
        />
      </Panel>
      <View style={S.row}>
        <Choice
          label="言葉を選ぶ"
          selected={mode === "pick"}
          onPress={() => setMode("pick")}
        />
        <Choice
          label="自由に書く"
          selected={mode === "free"}
          onPress={() => setMode("free")}
        />
      </View>
      {mode === "pick" && (
        <View style={S.wrap}>
          {VIBES.map((v) => (
            <View key={v} style={{ width: "48%" }}>
              <Choice
                label={v}
                selected={sel === v}
                onPress={() => setSel(v)}
              />
            </View>
          ))}
        </View>
      )}
      <Field
        label={
          mode === "pick"
            ? "なぜそう感じましたか？（必須・140文字まで）"
            : "印象と、その理由（8〜140文字）"
        }
        value={text}
        maxLength={140}
        multiline
        onChangeText={(v) => {
          setText(v);
          setSum(null);
        }}
        placeholder="例：発表の準備中、困っている人に声をかけてくれたから"
      />
      <T size={12}>{text.length}/140</T>
      {mode === "free" && (
        <>
          <Btn
            plain
            small
            label={sum ? "もう一度要約" : "要約する"}
            icon="spark"
            disabled={text.trim().length < 8}
            onPress={() => setSum(summarize(text))}
          />
          {sum && (
            <>
              <Panel>
                <T color={C.ink}>要約：{sum.label}</T>
                <T size={12} color={C.muted}>
                  近い強みカード（変更できます）
                </T>
              </Panel>
              <View style={S.wrap}>
                {Object.entries(CARDS).map(([k, c]) => (
                  <Choice
                    key={k}
                    label={c.name}
                    selected={sum.card === k}
                    onPress={() => setSum({ ...sum, card: k })}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
      <Panel>
        <T color={C.muted} size={12}>
          {PEOPLE[c.peerId].name}に贈る印象
        </T>
        <T color={C.ink}>
          {mode === "pick"
            ? sel || "言葉を1つ選んでください"
            : text || "相手に感じた印象を書いてください"}
        </T>
      </Panel>
      <Btn
        label="この印象を贈る"
        disabled={
          !ready || c.status !== "accepted" || s.blocked.includes(c.peerId)
        }
        onPress={send}
      />
      <LinkButton
        label="あとで"
        onPress={() => {
          update((x) => {
            const cc = x.connections.find((v) => v.id === cid);
            if (cc) cc.later = true;
          });
          nav.pop();
        }}
      />
    </Board>
  );
}
export function Memo() {
  const { s, update, nav, toast } = useApp(),
    [step, setStep] = useState(0),
    [to, setTo] = useState(""),
    [card, setCard] = useState(""),
    [story, setStory] = useState(""),
    [sent, setSent] = useState(false);
  const members = [
    ...new Set(
      s.connections
        .filter((c) => c.status === "accepted" && !s.blocked.includes(c.peerId))
        .map((c) => c.peerId),
    ),
  ];
  const send = () => {
    const allowed = update((x) => {
      if (
        !x.connections.some(
          (c) => c.peerId === to && c.status === "accepted",
        ) ||
        x.blocked.includes(to) ||
        story.trim().length < 8 ||
        !CARDS[card]
      )
        return false;
      x.sentProofs.push({
        id: "sp-" + Date.now(),
        toId: to,
        card,
        story: story.trim(),
        kind: "proof",
        createdAt: now(),
      });
      return true;
    });
    if (allowed) {
      setSent(true);
      toast(`${PEOPLE[to].name}に封筒を贈りました（デモ）`);
    }
  };
  if (sent)
    return (
      <Board>
        <Header title="" onBack={nav.root} />
        <View style={{ flex: 1, justifyContent: "center", gap: 16 }}>
          <View style={{ alignItems: "center" }}>
            <Envelope size={180} />
          </View>
          <Panel>
            <T color={C.muted} size={12}>
              {PEOPLE[to].name}へ · {CARDS[card].name}
            </T>
            <T display color={C.ink}>
              「{story}」
            </T>
          </Panel>
          <T display size={26} style={{ textAlign: "center" }}>
            封筒で贈りました
          </T>
          <T size={12}>端末内に記録しました。相手への通信は未接続です。</T>
        </View>
        <Btn plain label="交換へ戻る" onPress={nav.root} />
      </Board>
    );
  return (
    <Board>
      <Header
        title="見た場面をメモで贈る"
        onBack={() => (step ? setStep(step - 1) : nav.pop())}
        right={<T size={12}>{step + 1}/3</T>}
      />
      <ScrollView
        style={S.fill}
        contentContainerStyle={{ gap: 14, paddingBottom: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <T display size={26}>
          {step === 0
            ? "誰に贈る？"
            : step === 1
              ? `${PEOPLE[to]?.name}の、どの強み？`
              : "その強みを見た場面は？"}
        </T>
        {step === 0 &&
          (!members.length ? (
            <T>
              まだ交換した人がいません。交換すると、ここから場面のメモを贈れます。
            </T>
          ) : (
            members.map((id) => (
              <Choice
                key={id}
                label={PEOPLE[id].name}
                selected={to === id}
                onPress={() => setTo(id)}
              />
            ))
          ))}
        {step === 1 && (
          <View style={S.wrap}>
            {Object.entries(CARDS).map(([k, c]) => (
              <Choice
                key={k}
                label={c.name}
                selected={card === k}
                onPress={() => setCard(k)}
              />
            ))}
          </View>
        )}
        {step === 2 && (
          <>
            <T size={13}>性格の採点ではなく、見た行動をひとつ</T>
            <Field
              label="場面（8〜80文字）"
              value={story}
              multiline
              maxLength={80}
              onChangeText={setStory}
              placeholder="例：登壇後の質問に、図を描いて答えてくれた"
            />
            <T size={12}>{story.length}/80</T>
          </>
        )}
      </ScrollView>
      <Btn
        label={step < 2 ? "次へ" : "封筒で贈る"}
        disabled={![!!to, !!card, story.trim().length >= 8][step]}
        onPress={() => (step < 2 ? setStep(step + 1) : send())}
      />
    </Board>
  );
}
