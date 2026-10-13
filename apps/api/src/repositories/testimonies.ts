import { remoteTestimonySchema } from "@flocka/domain";
export type TestimonyRow = {
  id: string;
  exchange_id: string;
  sender_id: string;
  recipient_id: string;
  kind: "vibe" | "proof";
  card: string;
  label: string | null;
  text: string | null;
  story: string | null;
  opened: number;
  guess: string | null;
  visibility: "private" | "public" | "hidden";
  created_at: string;
};
export const toTestimony = (row: TestimonyRow) =>
  remoteTestimonySchema.parse({
    id: row.id,
    fromId: row.sender_id,
    exchangeId: row.exchange_id,
    kind: row.kind,
    card: row.card,
    label: row.label,
    text: row.text,
    story: row.story,
    opened: row.opened === 1,
    guess: row.guess,
    visibility: row.visibility,
    createdAt: row.created_at,
  });
