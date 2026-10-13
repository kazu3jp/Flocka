import { z } from "zod";
import sourceCatalog from "./catalog.json";

const catalogSchema = z.object({
  CARDS: z.record(
    z.string(),
    z.object({
      no: z.number(),
      name: z.string(),
      g: z.string(),
      h: z.number(),
      flavor: z.string(),
    }),
  ),
  SELF_OPTIONS: z.array(z.string()),
  STRENGTH_GROUPS: z.array(
    z.tuple([z.string(), z.string(), z.array(z.string())]),
  ),
  PEOPLE: z.record(
    z.string(),
    z.object({
      name: z.string(),
      role: z.string(),
      rel: z.string(),
      prose: z.string(),
    }),
  ),
  VIBES: z.array(z.string()),
  VIBE_CARD: z.record(z.string(), z.string()),
  INTERESTS: z.array(z.string()),
  DECO: z.object({
    pattern: z.array(z.tuple([z.string(), z.string()])),
    frame: z.array(z.tuple([z.string(), z.string()])),
    stickers: z.array(z.tuple([z.string(), z.string()])),
  }),
  DECO_COLORS: z.array(
    z.tuple([z.string(), z.string(), z.number().nullable()]),
  ),
  AV_COLORS: z.array(z.string()),
  AV_COLOR_NAMES: z.array(z.string()),
  AV_MOTIFS: z.array(z.tuple([z.string(), z.string()])),
  PEER_PROFILE: z.record(
    z.string(),
    z.object({
      avatar: z.object({ motif: z.string(), color: z.string() }),
      cards: z.array(z.tuple([z.string(), z.number()])),
      interests: z.array(z.string()),
    }),
  ),
  PEER_REPLY: z.record(
    z.string(),
    z.object({ card: z.string(), label: z.string(), text: z.string() }),
  ),
  ART_COLORS: z.record(
    z.string(),
    z.object({
      base: z.string(),
      shade: z.string(),
      shade2: z.string(),
      light: z.string(),
    }),
  ),
  COLORS: z.record(z.string(), z.string()),
  IC: z.record(z.string(), z.string()),
});

// Validate the offline design import once, before either app uses its catalog.
export const {
  CARDS,
  SELF_OPTIONS,
  STRENGTH_GROUPS,
  PEOPLE,
  VIBES,
  VIBE_CARD,
  INTERESTS,
  DECO,
  DECO_COLORS,
  AV_COLORS,
  AV_COLOR_NAMES,
  AV_MOTIFS,
  PEER_PROFILE,
  PEER_REPLY,
  ART_COLORS,
  COLORS,
  IC,
} = catalogSchema.parse(sourceCatalog);
