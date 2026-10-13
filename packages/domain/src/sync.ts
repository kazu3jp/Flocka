import type { Preferences, RemoteSnapshot } from "./api";
import type { Piece, SentPiece, State } from "./types";

export function preferencesOf(state: State): Preferences {
  return {
    showcase: state.showcase,
    resp: state.resp,
    deco: state.deco,
    prDraft: state.prDraft,
  };
}
export function applySnapshot(
  snapshot: RemoteSnapshot,
  previous: State,
  keepLocalPreferences = false,
): State {
  const pieces: Piece[] = snapshot.inbox
    .filter((piece) => !snapshot.blocked.includes(piece.fromId))
    .map((piece) => ({
      id: piece.id,
      fromId: piece.fromId,
      card: piece.card,
      kind: piece.kind,
      label: piece.label ?? undefined,
      text: piece.text ?? undefined,
      story: piece.story ?? undefined,
      opened: piece.opened,
      guess: piece.guess,
      visibility: piece.visibility,
      createdAt: piece.createdAt,
    }));
  const sent: SentPiece[] = snapshot.sent.map((piece) => ({
    id: piece.id,
    toId: piece.toId,
    card: piece.card,
    kind: piece.kind,
    label: piece.label ?? undefined,
    text: piece.text ?? undefined,
    story: piece.story ?? undefined,
    createdAt: piece.createdAt,
    context: snapshot.exchanges.find(
      (exchange) => exchange.id === piece.exchangeId,
    )?.context,
  }));
  return {
    ...previous,
    ...(keepLocalPreferences
      ? preferencesOf(previous)
      : snapshot.preferences.data),
    onboarded: true,
    profile: snapshot.player.profile,
    self: snapshot.player.self,
    connections: snapshot.exchanges.map((exchange) => ({
      id: exchange.id,
      peerId: exchange.peer.id,
      status: exchange.status,
      myApproved: exchange.myApproved,
      context: exchange.context,
      exchangedAt: exchange.createdAt,
      vibe:
        snapshot.sent.find(
          (piece) => piece.kind === "vibe" && piece.toId === exchange.peer.id,
        )?.id ?? null,
      later:
        previous.connections.find((connection) => connection.id === exchange.id)
          ?.later ?? false,
    })),
    vibes: pieces.filter((piece) => piece.kind === "vibe"),
    proofs: pieces.filter((piece) => piece.kind === "proof"),
    sentVibes: sent.filter((piece) => piece.kind === "vibe"),
    sentProofs: sent.filter((piece) => piece.kind === "proof"),
    blocked: snapshot.blocked,
    settings: snapshot.settings,
    reports: snapshot.requests
      .filter((request) => request.kind === "report")
      .map((request) => ({ ...request, reason: request.reason ?? undefined })),
    deletions: snapshot.requests
      .filter((request) => request.kind === "deletion")
      .map((request) => ({ ...request, reason: request.reason ?? undefined })),
  };
}
