import { CARDS } from "./catalog";

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
  exchangeId?: string;
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
  visibilityRevision?: number;
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
  id?: string;
  status?: "pending" | "reviewed" | "removed" | "rejected";
  resolution?: string | null;
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
  prDraftSource?: { card: string; pieceIds: string[] } | null;
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
