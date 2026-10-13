import catalog from "./catalog.json";

export const {
  CARDS,
  STRENGTH_GROUPS,
  PEOPLE,
  VIBES,
  VIBE_CARD,
  INTERESTS,
  DECO,
  DECO_COLORS,
  AV_COLORS,
  AV_COLOR_NAMES,
  AV_MOTIFS,
  PEER_PROFILE,
  PEER_REPLY,
  ART_COLORS,
  COLORS,
  IC,
} = catalog as unknown as {
  CARDS: Record<
    string,
    { no: number; name: string; g: string; h: number; flavor: string }
  >;
  STRENGTH_GROUPS: [string, string, string[]][];
  PEOPLE: Record<
    string,
    { name: string; role: string; rel: string; prose: string }
  >;
  VIBES: string[];
  VIBE_CARD: Record<string, string>;
  INTERESTS: string[];
  DECO: Record<"pattern" | "frame" | "stickers", [string, string][]>;
  DECO_COLORS: [string, string, number | null][];
  AV_COLORS: string[];
  AV_COLOR_NAMES: string[];
  AV_MOTIFS: [string, string][];
  PEER_PROFILE: Record<
    string,
    {
      avatar: { motif: string; color: string };
      cards: [string, number][];
      interests: string[];
    }
  >;
  PEER_REPLY: Record<string, { card: string; label: string; text: string }>;
  ART_COLORS: Record<
    string,
    { base: string; shade: string; shade2: string; light: string }
  >;
  COLORS: Record<string, string>;
  IC: Record<string, string>;
};
export type AvatarData = {
  type: "initial" | "motif" | "photo";
  color: string;
  motif: string;
  photo?: string;
};
export type Profile = {
  name: string;
  role: string;
  interests: string[];
  avatar: AvatarData;
  links: { github: string };
};
export type Piece = {
  id: string;
  fromId: string;
  card: string;
  kind: "vibe" | "proof";
  label?: string;
  text?: string;
  title?: string;
  story?: string;
  opened: boolean;
  guess: string | null;
  guessedAt?: string;
  visibility: "private" | "public" | "hidden";
  createdAt: string;
};
export type SentPiece = {
  id: string;
  toId: string;
  card: string;
  kind: "vibe" | "proof";
  label?: string;
  text?: string;
  story?: string;
  context?: { place: string; trigger: string };
  createdAt: string;
};
export type Connection = {
  id: string;
  peerId: string;
  status: "pending" | "accepted" | "cancelled";
  myApproved: boolean;
  exchangedAt?: string;
  context: { place: string; trigger: string };
  vibe: string | null;
  later: boolean;
};
export type DecoData = {
  pattern: string;
  frame: string;
  stickers: string[];
  color: string;
  layout?: Record<string, { position: string; size: number; angle: number }>;
};
export type RequestRecord = {
  pieceId: string;
  reason?: string;
  at: string;
  withdrawn?: boolean;
};
export type State = {
  schemaVersion: 1;
  onboarded: boolean;
  profile: Profile;
  self: string[];
  showcase: string[];
  connections: Connection[];
  vibes: Piece[];
  proofs: Piece[];
  sentVibes: SentPiece[];
  sentProofs: SentPiece[];
  resp: Record<string, "agree" | "hold" | "disagree">;
  deco: Record<string, DecoData>;
  prDraft: string | null;
  blocked: string[];
  settings: { allowVibe: boolean; allowProof: boolean; onlyConnected: boolean };
  reports: RequestRecord[];
  deletions: RequestRecord[];
};
export type Card = (typeof CARDS)[string] & {
  key: string;
  deco?: DecoData;
  self: boolean;
  testimonies: Piece[];
  givers: string[];
  confirmed: boolean;
  discovered: boolean;
};
export const now = () => new Date().toISOString();
export const fresh = (): State => ({
  schemaVersion: 1,
  onboarded: false,
  profile: {
    name: "",
    role: "",
    interests: [],
    links: { github: "" },
    avatar: { type: "initial", color: AV_COLORS[0], motif: "rocket" },
  },
  self: [],
  showcase: [],
  connections: [],
  vibes: [],
  proofs: [],
  sentVibes: [],
  sentProofs: [],
  resp: {},
  deco: {},
  prDraft: null,
  blocked: [],
  settings: { allowVibe: true, allowProof: true, onlyConnected: true },
  reports: [],
  deletions: [],
});
export const defaultDeco = (): DecoData => ({
  pattern: "burst",
  frame: "none",
  stickers: [],
  color: "original",
});
export const bareCard = (key: string, self = true): Card => ({
  key,
  ...CARDS[key],
  self,
  testimonies: [],
  givers: [],
  confirmed: false,
  discovered: false,
});
export const allPieces = (s: State) => [
  ...s.vibes.map((p) => ({ ...p, kind: "vibe" as const })),
  ...s.proofs.map((p) => ({ ...p, kind: "proof" as const })),
];
export const wordsOf = (p: Piece) =>
  p.kind === "proof" ? p.story || p.title || "" : p.text || p.label || "";
export function optionsFor(p: Piece, self: string[]) {
  const pool = [
    ...self.filter((k) => k !== p.card),
    ...catalog.SELF_OPTIONS.filter((k) => k !== p.card && !self.includes(k)),
  ];
  let hash = 7;
  for (const c of p.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const a = [pool[0], pool[1], p.card],
    k = hash % 3;
  return a.slice(k).concat(a.slice(0, k));
}
export function derive(s: State) {
  const pieces = allPieces(s)
    .filter((p) => p.visibility !== "hidden" && !s.blocked.includes(p.fromId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const opened = pieces.filter((p) => p.opened),
    unopened = pieces.filter((p) => !p.opened);
  const cards: Record<string, Card> = {};
  for (const k of Object.keys(CARDS)) {
    const testimonies = opened.filter((p) => p.card === k),
      givers = [...new Set(testimonies.map((p) => p.fromId))],
      self = s.self.includes(k);
    cards[k] = {
      ...bareCard(k, self),
      deco: s.deco[k],
      testimonies,
      givers,
      confirmed: givers.length >= 2,
      discovered: !self && testimonies.some((p) => p.guess !== p.card),
    };
  }
  const rank = (c: Card) =>
    (c.confirmed ? 100 : 0) +
    (c.discovered ? 50 : 0) +
    c.givers.length * 10 +
    (c.self ? 1 : 0);
  const deck = Object.values(cards)
    .filter((c) => c.self || c.testimonies.length)
    .sort((a, b) => rank(b) - rank(a));
  return {
    pieces,
    opened,
    unopened,
    cards,
    deck,
    prCard: deck.find((c) => c.confirmed && s.resp[c.key] !== "disagree"),
    best: Math.min(2, Math.max(0, ...deck.map((c) => c.givers.length))),
  };
}
export function openPiece(s: State, id: string, guess: string) {
  const p = [...s.vibes, ...s.proofs].find((x) => x.id === id);
  if (p && !p.opened) {
    p.opened = true;
    p.guess = guess;
    p.guessedAt = now();
  }
}
export function buildPR(s: State) {
  const c = derive(s).prCard;
  if (!c) return null;
  const ts = [...c.testimonies]
    .sort((a, b) => Number(b.kind === "proof") - Number(a.kind === "proof"))
    .slice(0, 3);
  let last = "";
  const quotes = ts
    .map((p, i) => {
      const place = (
        s.connections.find((x) => x.peerId === p.fromId)?.context.place || ""
      ).trim();
      const prefix =
        i === 0
          ? `${place ? place + "では、" : ""}一緒に活動した仲間から`
          : `また、${place ? (place === last ? "同じ場で" : place + "で") : ""}別の仲間からも`;
      last = place || last;
      return `${prefix}「${wordsOf(p)}」${i === 0 ? "と言われました。" : "という声をもらいました。"}`;
    })
    .join("");
  const names = s.self
    .filter((k) => k !== c.key)
    .map((k) => CARDS[k].name)
    .join("・");
  const reflection =
    !c.self && names
      ? `自分では${names}を強みだと考えていましたが、複数の仲間から同じ点を挙げてもらったことで、${c.name}という一面に気づきました。`
      : "自分でも意識していた強みですが、複数の仲間から同じ点を挙げてもらい、確信に変わりました。";
  return {
    text: `私の強みは「${c.name}」です。\n${quotes}\n${reflection}\nこの強みを活かして、（ここに、これから取り組みたいことを書こう）。`,
    sources: [...new Set(ts.map((p) => p.fromId))],
    card: c,
  };
}
export function summarize(text: string) {
  const rules: [string, RegExp, string][] = [
    [
      "warm",
      /話しやす|話しかけ|緊張せず|聞いてくれ|親しみ|優し/g,
      "初対面でも話しやすい",
    ],
    [
      "bridge",
      /説明|分かりやす|わかりやす|整理|まとめ|共有|伝え/g,
      "分かりやすく伝えてくれる",
    ],
    [
      "curious",
      /質問|調べ|好奇心|深掘|なぜ|知りたい/g,
      "好奇心が強く、よく掘り下げる",
    ],
    ["idea", /面白|発想|アイデア|着眼|ユニーク|視点/g, "着眼点が面白い"],
    ["passion", /熱|情熱|楽しそう|ワクワク|本気/g, "熱量が伝わる"],
    ["impl", /実装|コード|作って|動く|速い|手を動かす/g, "手を動かすのが速い"],
    ["design", /設計|構成|全体|アーキテクチャ/g, "全体を設計できる"],
    ["grit", /粘り|諦め|最後まで|やり切/g, "最後までやり切る"],
    ["focus", /集中|没頭|黙々/g, "集中力がすごい"],
  ];
  const hits = rules
    .map(([card, re, label]) => ({
      card,
      label,
      n: (text.match(re) || []).length,
    }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);
  return (
    hits[0] || {
      card: "warm",
      label: text.replace(/[。、\s].*$/, "").slice(0, 18) || "また話したい",
    }
  );
}
export function startExchange(s: State, peerId: string) {
  if (!PEOPLE[peerId] || s.blocked.includes(peerId)) return null;
  const old = s.connections.find(
    (c) => c.peerId === peerId && c.status !== "cancelled",
  );
  if (old) return old.id;
  const id = `c-${peerId}-${Date.now()}`;
  s.connections.push({
    id,
    peerId,
    status: "pending",
    myApproved: false,
    context: { place: "", trigger: "" },
    vibe: null,
    later: false,
  });
  return id;
}
export function parseDemoQR(value: string): string | null {
  const match = /^flocka-demo:\/\/peer\/(mock-[abc])$/.exec(value);
  return match && PEOPLE[match[1]] ? match[1] : null;
}
// The original prototype uses local sample peers; no remote approval is implied.
export function approveExchange(s: State, id: string) {
  const c = s.connections.find((c) => c.id === id);
  if (
    !c ||
    c.status !== "pending" ||
    s.blocked.includes(c.peerId) ||
    !c.context.place.trim() ||
    !c.context.trigger.trim()
  )
    return false;
  c.myApproved = true;
  c.status = "accepted";
  c.exchangedAt = now();
  const reply = PEER_REPLY[c.peerId];
  if (
    reply &&
    s.settings.allowVibe &&
    !s.vibes.some((p) => p.id === `rv-${c.peerId}`)
  )
    s.vibes.push({
      id: `rv-${c.peerId}`,
      fromId: c.peerId,
      ...reply,
      kind: "vibe",
      opened: false,
      guess: null,
      visibility: "private",
      createdAt: now(),
    });
  return true;
}
export function demoState(): State {
  const x = fresh(),
    at = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
  x.onboarded = true;
  x.profile = {
    ...x.profile,
    name: "ハルカ",
    role: "ハッカソンでよく実装担当",
    interests: ["Web開発", "チーム開発", "AI・データ"],
  };
  x.self = ["impl", "focus"];
  const ctx: Record<string, [string, string]> = {
    "mock-a": ["学内ハッカソン", "同じチームでUIを担当"],
    "mock-b": ["学内ハッカソン", "発表資料を一緒に作った"],
    "mock-c": ["開発勉強会", "懇親会で隣の席だった"],
  };
  x.connections = Object.entries(ctx).map(([peerId, [place, trigger]], i) => ({
    id: "c-" + peerId,
    peerId,
    status: "accepted",
    myApproved: true,
    vibe: null,
    later: false,
    exchangedAt: at(30 - i),
    context: { place, trigger },
  }));
  const v = (
    id: string,
    fromId: string,
    card: string,
    label: string,
    text: string,
    opened: boolean,
    guess: string | null,
    h: number,
  ): Piece => ({
    id,
    fromId,
    card,
    label,
    text,
    opened,
    guess,
    kind: "vibe",
    visibility: "private",
    createdAt: at(h),
  });
  x.vibes = [
    v(
      "v1",
      "mock-a",
      "bridge",
      "分かりやすく伝えてくれる",
      "UIの相談をしたら、技術の話をかみ砕いて説明してくれた",
      true,
      "impl",
      20,
    ),
    v(
      "v2",
      "mock-b",
      "bridge",
      "分かりやすく伝えてくれる",
      "発表の前に、みんなの意見を整理してまとめてくれた",
      true,
      "focus",
      18,
    ),
    v(
      "v3",
      "mock-a",
      "impl",
      "手を動かすのが速い",
      "話したアイデアを、その日のうちに動く形にしてくれた",
      true,
      "impl",
      16,
    ),
    v(
      "v4",
      "mock-c",
      "warm",
      "話しやすい",
      "初対面なのに、緊張せずに話せた",
      false,
      null,
      2,
    ),
  ];
  return x;
}
export const ROOTS = { find: "deck", exchange: "exchange", pr: "pr" } as const;
export type Tab = keyof typeof ROOTS;
export const SCREENS = [
  "deck",
  "card",
  "deco",
  "me",
  "avatar",
  "selfEdit",
  "pieces",
  "piece",
  "settings",
  "exchange",
  "connections",
  "nearby",
  "scan",
  "confirm",
  "give",
  "memo",
  "pr",
  "onboarding",
] as const;
export type ScreenId = (typeof SCREENS)[number];
export type Entry = { id: ScreenId; params?: Record<string, string> };
export type NavState = { tab: Tab; stacks: Record<Tab, Entry[]> };
export const initNav = (): NavState => ({
  tab: "find",
  stacks: {
    find: [{ id: "deck" }],
    exchange: [{ id: "exchange" }],
    pr: [{ id: "pr" }],
  },
});
export function validNav(v: unknown): v is NavState {
  if (!v || typeof v !== "object") return false;
  const n = v as NavState;
  return (
    n.tab in ROOTS &&
    Object.keys(ROOTS).every((k) => {
      const a = n.stacks?.[k as Tab];
      return (
        Array.isArray(a) &&
        a.length > 0 &&
        a.length < 50 &&
        a[0].id === ROOTS[k as Tab] &&
        a.every(
          (e) =>
            SCREENS.includes(e.id) &&
            (!e.params ||
              Object.values(e.params).every((v) => typeof v === "string")),
        )
      );
    })
  );
}
export function restoreState(raw: string | null): State {
  if (!raw) return fresh();
  const v: State = JSON.parse(raw);
  if (
    v.schemaVersion !== 1 ||
    !v.profile ||
    !Array.isArray(v.self) ||
    !Array.isArray(v.vibes) ||
    !Array.isArray(v.proofs) ||
    !Array.isArray(v.connections)
  )
    throw new Error("保存データの形式を読み込めませんでした");
  const initial = fresh();
  return {
    ...initial,
    ...v,
    profile: {
      ...initial.profile,
      ...v.profile,
      avatar: { ...initial.profile.avatar, ...v.profile.avatar },
    },
    settings: { ...initial.settings, ...v.settings },
    self: v.self.filter((k) => CARDS[k]),
    vibes: v.vibes.filter((p) => CARDS[p.card] && PEOPLE[p.fromId]),
    proofs: v.proofs.filter((p) => CARDS[p.card] && PEOPLE[p.fromId]),
    connections: v.connections.filter((c) => PEOPLE[c.peerId]),
  };
}
