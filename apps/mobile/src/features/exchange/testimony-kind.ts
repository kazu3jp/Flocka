import type { Connection } from "@flocka/domain";

/**
 * The two kinds of testimony the server keeps, as one form: the first one
 * to a person is the first impression (once per person), later ones are
 * episodes (several, within the server's limit).
 */
export type TestimonyKind = "vibe" | "proof";

export const testimonyKind = (connection: Pick<Connection, "vibe">) =>
  connection.vibe ? ("proof" as const) : ("vibe" as const);

/** Long enough to say what was seen, and enough for a card suggestion. */
export const TESTIMONY_TEXT_MIN = 8;

/** The server's limits: an impression's reason, or an episode's story. */
export const testimonyTextMax = (kind: TestimonyKind) =>
  kind === "vibe" ? 140 : 80;
