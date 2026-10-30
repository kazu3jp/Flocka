import { derive, wordsOf } from "./game";
import type { State } from "./types";

export type PRSegment =
  { kind: "text" | "quote" | "placeholder"; text: string } | { kind: "break" };

/** Keep quotations and writing prompts identifiable without inventing evidence. */
export function buildPR(state: State, cardKey?: string) {
  const derived = derive(state);
  const card = cardKey ? derived.cards[cardKey] : derived.prCard;
  if (!card?.confirmed || state.resp[card.key] === "disagree") return null;
  const witnesses = new Set<string>();
  const testimonies = [...card.testimonies]
    .sort((a, b) => Number(b.kind === "proof") - Number(a.kind === "proof"))
    .filter((piece) => {
      if (witnesses.has(piece.fromId)) return false;
      witnesses.add(piece.fromId);
      return true;
    })
    .slice(0, 3);
  // The catalog card name reads as a game label, so the draft leaves it out
  // and lets the givers' words say what the strength is.
  const segments: PRSegment[] = [];
  let lastPlace = "";
  testimonies.forEach((piece, index) => {
    const place = (
      state.connections.find((connection) => connection.id === piece.exchangeId)
        ?.context.place ?? ""
    ).trim();
    const prefix =
      index === 0
        ? `${place ? place + "では、" : ""}仲間から`
        : `また、${place ? (place === lastPlace ? "同じ場で" : place + "で") : ""}別の仲間からも`;
    segments.push(
      { kind: "text", text: prefix },
      { kind: "quote", text: `「${wordsOf(piece)}」` },
      {
        kind: "text",
        text: index === 0 ? "と言われました。" : "という声をもらいました。",
      },
    );
    lastPlace = place || lastPlace;
  });
  // Only what the app knows: the givers' words and the owner's own card choice.
  segments.push(
    { kind: "break" },
    {
      kind: "text",
      text: card.self
        ? "自分でも強みとして選んでいた点を、複数の仲間からも挙げてもらいました。"
        : "複数の仲間から、同じ点を挙げてもらいました。",
    },
    { kind: "break" },
    { kind: "text", text: "この点を活かして、" },
    {
      kind: "placeholder",
      text: "（ここに、これから取り組みたいことを書こう）",
    },
    { kind: "text", text: "。" },
  );
  return {
    segments,
    text: segments
      .map((segment) => (segment.kind === "break" ? "\n" : segment.text))
      .join(""),
    pieceIds: testimonies.map((piece) => piece.id),
    sources: [...new Set(testimonies.map((piece) => piece.fromId))],
    card,
  };
}

/** Saved text is attributed only to its saved, still-verifiable evidence. */
export function resolvePRDocument(state: State) {
  const generated = buildPR(state);
  if (state.prDraft === null)
    return { document: generated, generated, sourceKnown: true };
  const source = state.prDraftSource;
  if (source) {
    const opened = derive(state).opened;
    const pieces = source.pieceIds.map((id) =>
      opened.find((piece) => piece.id === id),
    );
    const sources = [
      ...new Set(pieces.flatMap((piece) => (piece ? [piece.fromId] : []))),
    ];
    const anchored = buildPR(state, source.card);
    if (
      anchored &&
      pieces.every((piece) => piece?.card === source.card) &&
      sources.length >= 2
    )
      return {
        document: { ...anchored, sources, pieceIds: source.pieceIds },
        generated,
        sourceKnown: true,
      };
  }
  return { document: generated, generated, sourceKnown: false };
}
