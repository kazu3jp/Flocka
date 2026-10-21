import { CARDS } from "./catalog";
import { bareCard, now } from "./state";
import type { State, Piece, Card } from "./types";

export const allPieces = (s: State) => [
  ...s.vibes.map((p) => ({ ...p, kind: "vibe" as const })),
  ...s.proofs.map((p) => ({ ...p, kind: "proof" as const })),
];

export const wordsOf = (p: Piece) =>
  p.kind === "proof" ? p.story || p.title || "" : p.text || p.label || "";

/** Catalog lookups must not resolve inherited keys such as "constructor" from a URL. */
export const isCardKey = (key: string) => Object.hasOwn(CARDS, key);

function seededRandom(seed: string) {
  let state = 7;
  for (const c of seed) state = (state * 31 + c.charCodeAt(0)) >>> 0;
  // mulberry32: a small deterministic generator, so options never change between renders.
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number) {
  return items.splice(Math.floor(random() * items.length), 1)[0];
}

/**
 * Three fixed choices per envelope. At most one wrong choice is a self-claimed
 * strength, so an unexpected answer is never the only card the user did not
 * claim, while the user's own picks can still tempt them.
 */
export function optionsFor(p: Piece, self: string[]) {
  const random = seededRandom(p.id);
  const claimed = [...new Set(self)].filter(
    (key) => key !== p.card && isCardKey(key),
  );
  const others = Object.keys(CARDS).filter(
    (key) => key !== p.card && !claimed.includes(key),
  );
  const wrong: string[] = [];
  if (claimed.length && random() < 2 / 3) wrong.push(pick(claimed, random));
  while (wrong.length < 2) wrong.push(pick(others, random));
  const options = [p.card, ...wrong];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [options[index], options[swap]] = [options[swap], options[index]];
  }
  return options;
}

/** A skipped guess is not a missed guess, so it never marks a discovery. */
const missedGuess = (p: Piece) =>
  p.guess !== null && p.guess !== "skip" && p.guess !== p.card;

export function derive(s: State) {
  const pieces = allPieces(s)
    .filter((p) => p.visibility !== "hidden" && !s.blocked.includes(p.fromId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const opened = pieces.filter((p) => p.opened),
    unopened = pieces.filter((p) => !p.opened);
  // No prototype, so lookups by an untrusted key never hit Object.prototype.
  const cards: Record<string, Card> = Object.create(null);
  for (const k of Object.keys(CARDS)) {
    const testimonies = opened.filter((p) => p.card === k),
      givers = [...new Set(testimonies.map((p) => p.fromId))],
      self = s.self.includes(k);
    cards[k] = {
      ...bareCard(k, self),
      deco: Object.hasOwn(s.deco, k) ? s.deco[k] : undefined,
      testimonies,
      givers,
      confirmed: givers.length >= 2,
      discovered: !self && testimonies.some(missedGuess),
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
  // A card the user disagreed with cannot become the PR, so it is not progress toward one.
  const usable = deck.filter((c) => s.resp[c.key] !== "disagree");
  return {
    pieces,
    opened,
    unopened,
    cards,
    deck,
    prCard: usable.find((c) => c.confirmed),
    best: Math.min(2, Math.max(0, ...usable.map((c) => c.givers.length))),
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
