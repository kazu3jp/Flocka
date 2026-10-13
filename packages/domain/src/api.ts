import { z } from "zod";
import { CARDS } from "./catalog";
import type { State } from "./types";

export const strengthKeySchema = z
  .string()
  .refine((key) => Object.hasOwn(CARDS, key), "強みカードが見つかりません");
const guessSchema = z.union([strengthKeySchema, z.literal("skip")]);
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(16),
  role: z.string().max(24),
  interests: z.array(z.string().max(40)).max(32),
  avatar: z.object({
    type: z.enum(["initial", "motif", "photo"]),
    color: z.string().max(40),
    motif: z.string().max(30),
    photo: z.string().max(1_000_000).optional(),
  }),
  links: z.object({ github: z.string().max(200) }),
});
export const createAccountSchema = z.object({
  profile: profileSchema,
  self: z.array(strengthKeySchema).min(2).max(3),
});
export const remotePlayerSchema = z.object({
  id: z.string().uuid(),
  profile: profileSchema,
  self: z.array(strengthKeySchema),
  avatarAvailable: z.boolean(),
});
export type RemotePlayer = z.infer<typeof remotePlayerSchema>;
export const inviteSchema = z.object({
  code: z.string(),
  expiresAt: z.string(),
});
export const createExchangeSchema = z.object({
  code: z.string().min(32).max(200),
});
export const meetingContextSchema = z.object({
  place: z.string().trim().min(1).max(60),
  trigger: z.string().trim().min(1).max(100),
});
export const remoteExchangeSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "accepted", "cancelled"]),
  myApproved: z.boolean(),
  peerApproved: z.boolean(),
  peer: remotePlayerSchema,
  context: z.object({ place: z.string(), trigger: z.string() }),
  createdAt: z.string(),
});
export type RemoteExchange = z.infer<typeof remoteExchangeSchema>;
export const createTestimonySchema = z.discriminatedUnion("kind", [
  z.object({
    exchangeId: z.string().uuid(),
    kind: z.literal("vibe"),
    card: strengthKeySchema,
    label: z.string().trim().min(1).max(40),
    text: z.string().trim().min(1).max(140),
  }),
  z.object({
    exchangeId: z.string().uuid(),
    kind: z.literal("proof"),
    card: strengthKeySchema,
    story: z.string().trim().min(8).max(80),
  }),
]);
export const testimonyPatchSchema = z
  .object({
    opened: z.literal(true).optional(),
    guess: guessSchema.optional(),
    visibility: z.enum(["private", "public", "hidden"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "変更する項目がありません")
  .refine(
    (value) => !value.opened || value.guess !== undefined,
    "開封時は予想またはskipが必要です",
  );
export const remoteTestimonySchema = z.object({
  id: z.string().uuid(),
  fromId: z.string().uuid(),
  exchangeId: z.string().uuid(),
  kind: z.enum(["vibe", "proof"]),
  card: strengthKeySchema,
  label: z.string().nullable(),
  text: z.string().nullable(),
  story: z.string().nullable(),
  opened: z.boolean(),
  guess: z.string().nullable(),
  visibility: z.enum(["private", "public", "hidden"]),
  createdAt: z.string(),
});
export type RemoteTestimony = z.infer<typeof remoteTestimonySchema>;
export const settingsSchema = z.object({
  allowVibe: z.boolean(),
  allowProof: z.boolean(),
  onlyConnected: z.boolean(),
});
export const moderationSchema = z.object({
  pieceId: z.string().uuid(),
  kind: z.enum(["report", "deletion"]),
  reason: z.enum(["不適切な内容", "嫌がらせ", "個人情報", "その他"]).optional(),
});

const pieceSchema = z.object({
  id: z.string().max(100),
  fromId: z.string().max(100),
  card: strengthKeySchema,
  kind: z.enum(["vibe", "proof"]),
  label: z.string().optional(),
  text: z.string().optional(),
  title: z.string().optional(),
  story: z.string().optional(),
  opened: z.boolean(),
  guess: z.string().nullable(),
  guessedAt: z.string().optional(),
  visibility: z.enum(["private", "public", "hidden"]),
  createdAt: z.string(),
});
const sentPieceSchema = z.object({
  id: z.string(),
  toId: z.string(),
  card: strengthKeySchema,
  kind: z.enum(["vibe", "proof"]),
  label: z.string().optional(),
  text: z.string().optional(),
  story: z.string().optional(),
  context: z.object({ place: z.string(), trigger: z.string() }).optional(),
  createdAt: z.string(),
});
const requestSchema = z.object({
  pieceId: z.string(),
  reason: z.string().optional(),
  at: z.string(),
  withdrawn: z.boolean().optional(),
});
export const appStateSchema: z.ZodType<State> = z.object({
  schemaVersion: z.literal(1),
  onboarded: z.boolean(),
  profile: profileSchema.extend({ name: z.string().max(16) }),
  self: z.array(strengthKeySchema).max(3),
  showcase: z.array(strengthKeySchema).max(3),
  connections: z
    .array(
      z.object({
        id: z.string(),
        peerId: z.string(),
        status: z.enum(["pending", "accepted", "cancelled"]),
        myApproved: z.boolean(),
        exchangedAt: z.string().optional(),
        context: z.object({ place: z.string(), trigger: z.string() }),
        vibe: z.string().nullable(),
        later: z.boolean(),
      }),
    )
    .max(1000),
  vibes: z.array(pieceSchema).max(1000),
  proofs: z.array(pieceSchema).max(1000),
  sentVibes: z.array(sentPieceSchema).max(1000),
  sentProofs: z.array(sentPieceSchema).max(1000),
  resp: z.record(strengthKeySchema, z.enum(["agree", "hold", "disagree"])),
  deco: z.record(
    strengthKeySchema,
    z.object({
      pattern: z.string(),
      frame: z.string(),
      stickers: z.array(z.string()).max(4),
      color: z.string(),
      layout: z
        .record(
          z.string(),
          z.object({
            position: z.string(),
            size: z.number(),
            angle: z.number(),
          }),
        )
        .optional(),
    }),
  ),
  prDraft: z.string().max(20_000).nullable(),
  blocked: z.array(z.string()).max(1000),
  settings: settingsSchema,
  reports: z.array(requestSchema).max(1000),
  deletions: z.array(requestSchema).max(1000),
});
export const backupRequestSchema = z.object({
  revision: z.number().int().min(1).nullable(),
  snapshot: appStateSchema,
  avatarKey: z.string().max(200).nullable().optional(),
});
export const backupRecordSchema = z.object({
  revision: z.number().int(),
  snapshot: appStateSchema,
  updatedAt: z.string(),
});
export type BackupRecord = z.infer<typeof backupRecordSchema>;
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export const preferencesSchema = z.object({
  showcase: z.array(strengthKeySchema).max(3),
  resp: z.record(strengthKeySchema, z.enum(["agree", "hold", "disagree"])),
  deco: z.record(
    strengthKeySchema,
    z.object({
      pattern: z.string().max(40),
      frame: z.string().max(40),
      stickers: z.array(z.string().max(40)).max(4),
      color: z.string().max(40),
      layout: z
        .record(
          z.string().max(40),
          z.object({
            position: z.string().max(40),
            size: z.number().min(5).max(80),
            angle: z.number().min(-360).max(360),
          }),
        )
        .optional(),
    }),
  ),
  prDraft: z.string().max(20_000).nullable(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const preferencesRecordSchema = z.object({
  data: preferencesSchema,
  revision: z.number().int().min(1),
});
export const remoteRequestSchema = z.object({
  id: z.string().uuid(),
  pieceId: z.string().uuid(),
  kind: z.enum(["report", "deletion"]),
  reason: z.string().nullable(),
  at: z.string(),
  withdrawn: z.boolean(),
  status: z.enum(["pending", "reviewed", "removed", "rejected"]),
  resolution: z.string().nullable(),
});
export const remoteSentSchema = remoteTestimonySchema.extend({
  toId: z.string().uuid(),
});
export const syncSchema = z.object({
  nextPage: z.number().int().nullable(),
  player: remotePlayerSchema,
  peers: z.array(remotePlayerSchema),
  settings: settingsSchema,
  exchanges: z.array(remoteExchangeSchema),
  inbox: z.array(remoteTestimonySchema),
  sent: z.array(remoteSentSchema),
  blocked: z.array(z.string().uuid()),
  requests: z.array(remoteRequestSchema),
  preferences: preferencesRecordSchema,
  isAdmin: z.boolean(),
});
export type RemoteSnapshot = z.infer<typeof syncSchema>;
export const inviteQR = (code: string) =>
  `flocka://exchange?code=${encodeURIComponent(code)}`;
export function parseInviteQR(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "flocka:" ||
      url.hostname !== "exchange" ||
      url.pathname !== "" ||
      url.searchParams.size !== 1
    )
      return null;
    const code = url.searchParams.get("code");
    return code && /^[A-Za-z0-9_-]{43}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
