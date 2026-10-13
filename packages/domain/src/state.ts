import { appStateSchema } from "./api";
import { CARDS, AV_COLORS, PEOPLE } from "./catalog";
import type { State, DecoData, Card, Piece } from "./types";

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
  return appStateSchema.parse({
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
  });
}
