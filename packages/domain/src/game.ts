import { CARDS, SELF_OPTIONS } from "./catalog";
import { bareCard, now } from "./state";
import type { State, Piece, Card } from "./types";

export const allPieces = (s: State) => [
  ...s.vibes.map((p) => ({ ...p, kind: "vibe" as const })),
  ...s.proofs.map((p) => ({ ...p, kind: "proof" as const })),
];

export const wordsOf = (p: Piece) =>
  p.kind === "proof" ? p.story || p.title || "" : p.text || p.label || "";

export function optionsFor(p: Piece, self: string[]) {
  const pool = [
    ...self.filter((k) => k !== p.card),
    ...SELF_OPTIONS.filter((k) => k !== p.card && !self.includes(k)),
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
