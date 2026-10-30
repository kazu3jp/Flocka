/** The source's flap / seal / slideUp / stamp / flash, paced as a two-second reveal. */
export const GUESS_MOTION = {
  anticipation: 340,
  flap: 360,
  exit: 140,
  note: { delay: 0, duration: 400 },
  card: { delay: 180, duration: 640 },
  stamp: { delay: 600, duration: 350 },
  gain: { delay: 950, duration: 220 },
} as const;
