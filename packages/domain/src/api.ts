import { PR_DRAFT_MAX_LENGTH } from "./limits";
import { decorationSchema } from "./decoration-schema";
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
  avatarVersion: z.string().nullable().optional(),
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
    expectedVisibilityRevision: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "変更する項目がありません")
  .refine(
    (value) => !value.opened || value.guess !== undefined,
    "開封時は予想またはskipが必要です",
  )
  .refine(
    (value) =>
      value.expectedVisibilityRevision === undefined ||
      value.visibility !== undefined,
    "変更番号は公開範囲と一緒に指定してください",
  );
export type TestimonyPatch = z.infer<typeof testimonyPatchSchema>;
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
  visibilityRevision: z.number().int().positive(),
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
  exchangeId: z.string().max(100).optional(),
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
  visibilityRevision: z.number().int().positive().optional(),
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
  id: z.string().optional(),
  status: z.enum(["pending", "reviewed", "removed", "rejected"]).optional(),
  resolution: z.string().nullable().optional(),
  pieceId: z.string(),
  reason: z.string().optional(),
  at: z.string(),
  withdrawn: z.boolean().optional(),
});
const prDraftSourceSchema = z
  .object({
    card: strengthKeySchema,
    pieceIds: z
      .array(z.string().min(1).max(100))
      .min(2)
      .max(3)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "引用元が重複しています",
      ),
  })
  .nullable()
  .optional();

export const appStateSchema: z.ZodType<State> = z.object({
  schemaVersion: z.literal(1),
  onboarded: z.boolean(),
  profile: profileSchema.extend({ name: z.string().max(16) }),
  self: z.array(strengthKeySchema).max(3),
  showcase: z.array(strengthKeySchema).max(3),
  connections: z.array(
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
  ),
  vibes: z.array(pieceSchema),
  proofs: z.array(pieceSchema),
  sentVibes: z.array(sentPieceSchema),
  sentProofs: z.array(sentPieceSchema),
  resp: z.record(strengthKeySchema, z.enum(["agree", "hold", "disagree"])),
  deco: z.record(strengthKeySchema, decorationSchema),
  prDraft: z.string().max(PR_DRAFT_MAX_LENGTH).nullable(),
  prDraftSource: prDraftSourceSchema,
  blocked: z.array(z.string()),
  settings: settingsSchema,
  reports: z.array(requestSchema),
  deletions: z.array(requestSchema),
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
  deco: z.record(strengthKeySchema, decorationSchema),
  prDraft: z.string().max(PR_DRAFT_MAX_LENGTH).nullable(),
  prDraftSource: prDraftSourceSchema,
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

export const pushDeviceSchema = z.object({
  token: z.string().min(10).max(200),
  platform: z.enum(["ios", "android"]),
});
export const resolveModerationSchema = z.object({
  status: z.enum(["reviewed", "removed", "rejected"]),
  note: z.string().trim().min(1).max(500),
});
export const pendingModerationSchema = z.object({
  id: z.string().uuid(),
  pieceId: z.string().uuid(),
  kind: z.enum(["report", "deletion"]),
  reason: z.string().nullable(),
  at: z.string(),
  pieceKind: z.enum(["vibe", "proof"]),
  excerpt: z.string(),
});
export const pendingModerationPageSchema = z.object({
  items: z.array(pendingModerationSchema),
  nextPage: z.number().int().nullable(),
});
export type PendingModeration = z.infer<typeof pendingModerationSchema>;
