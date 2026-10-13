import { PEOPLE, PEER_REPLY } from "./catalog";
import { now } from "./state";
import type { State } from "./types";

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
