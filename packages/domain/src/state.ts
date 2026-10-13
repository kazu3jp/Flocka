import { appStateSchema } from "./api";
import { CARDS, AV_COLORS } from "./catalog";
import type { State, DecoData, Card } from "./types";

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
    vibes: v.vibes.filter((p) => CARDS[p.card]),
    proofs: v.proofs.filter((p) => CARDS[p.card]),
    connections: v.connections,
  });
}
