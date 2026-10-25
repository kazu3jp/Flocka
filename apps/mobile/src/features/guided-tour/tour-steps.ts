/**
 * What the guided tour says, where it points, and when it is shown. Pure data
 * and decisions only: storage lives in use-first-launch-tour.ts, measuring in
 * tour-geometry.ts / tour-measure.ts, drawing in TourOverlay.tsx. The steps
 * follow docs/flocka-v2-screen-spec.md section 4.15.
 */

/** One key per install. The version lets a future rewrite show it again. */
export const TOUR_SEEN_KEY = "flocka-expo-tutorial-v1";
export const TOUR_SEEN_VALUE = "1";

/** The tabs a step can ask the app to show first (domain `Tab`). */
export type TourTab = "find" | "exchange" | "pr";

/** Ids screens register with useTourTarget. One id per real element. */
export const TOUR_TARGETS = {
  deckCards: "deck-cards",
  deckQuest: "deck-quest",
  deckGive: "deck-give",
  deckMe: "deck-me",
  playerCard: "player-card",
  exchangeActions: "exchange-actions",
  prHeading: "pr-heading",
} as const;

export type TourStep = {
  key: string;
  /** The id of the element the spotlight surrounds. */
  target: string;
  /** The tab root that has to be on screen for the target to exist. */
  tab: TourTab;
  /** An icon name from components/text.tsx. */
  icon: string;
  title: string;
  lead: string;
};

export const TOUR_STEPS: readonly TourStep[] = [
  {
    key: "deck",
    target: TOUR_TARGETS.deckCards,
    tab: "find",
    icon: "deck",
    title: "強みカードが、ここに集まる",
    lead: "届いた証言を開けると、その強みのカードがデッキに加わります。",
  },
  {
    key: "guess",
    target: TOUR_TARGETS.deckQuest,
    tab: "find",
    icon: "spark",
    title: "届いた封筒を予想して開ける",
    lead: "開ける前に、どの強みの証言か予想します。開けた証言はデッキに加わります。",
  },
  {
    key: "give",
    target: TOUR_TARGETS.deckGive,
    tab: "find",
    icon: "spark",
    title: "印象や場面のメモを贈る",
    lead: "交換した相手に、その人の強みが見えた印象や場面を贈れます。",
  },
  {
    key: "card",
    target: TOUR_TARGETS.playerCard,
    tab: "exchange",
    icon: "users",
    title: "これが、あなたのプレイヤーカード",
    lead: "見せたい強みカードを選べます。プロフィールにSNSのリンクを載せると、交換した相手にだけ見えます。",
  },
  {
    key: "exchange",
    target: TOUR_TARGETS.exchangeActions,
    tab: "exchange",
    icon: "swap",
    title: "会った人と、カードを交換",
    lead: "近くの人はBluetoothで、そうでなければQRで、プレイヤーカードを見せ合います。",
  },
  {
    key: "pr",
    target: TOUR_TARGETS.prHeading,
    tab: "pr",
    icon: "doc",
    title: "2人の証言で、自己PRに",
    lead: "同じ強みに2人以上の証言がそろうと確認済みに。その証言から自己PRの下書きができます。",
  },
  {
    key: "privacy",
    target: TOUR_TARGETS.deckMe,
    tab: "find",
    icon: "shield",
    title: "公開範囲は自分で決める",
    lead: "ここから「自分」を開き、「公開範囲・安全」で受け取る証言の範囲やブロック、通報を選べます。",
  },
];

/** True only for what this module wrote. Anything else counts as not seen. */
export function parseTourSeen(raw: string | null): boolean {
  return raw === TOUR_SEEN_VALUE;
}

/**
 * What this device knows about the flag. `unknown` is a read that has not
 * finished or failed: a storage error must never show the tour again to
 * someone who may have seen it.
 */
export type TourSeenState = "unknown" | "seen" | "unseen";

export function shouldShowFirstLaunchTour({
  seen,
  signedIn,
  accountReady,
  onboarded,
  onboardingScreen,
}: {
  seen: TourSeenState;
  /** A real account is signed in. The signed-out scope never gets a tour. */
  signedIn: boolean;
  /** The account's data came from the server and is on screen. */
  accountReady: boolean;
  onboarded: boolean;
  onboardingScreen: boolean;
}): boolean {
  return (
    seen === "unseen" &&
    signedIn &&
    accountReady &&
    onboarded &&
    !onboardingScreen
  );
}

/**
 * The index after `index` in `direction`, or null past either end. Past the
 * end going forward means the tour is finished.
 */
export function stepAfter(
  index: number,
  direction: 1 | -1,
  total: number = TOUR_STEPS.length,
): number | null {
  const next = index + direction;
  return next < 0 || next >= total ? null : next;
}

export function isLastStep(index: number, total: number = TOUR_STEPS.length) {
  return index >= total - 1;
}

/** "N枚中M枚目" read out when a step appears. */
export function stepAnnouncement(index: number, total: number): string {
  return `${total}枚中${index + 1}枚目`;
}

/**
 * What to do when the step at `index` has no target on screen: move on in the
 * direction the person was travelling. Going back past the first step turns
 * around and looks forward; going forward past the last one ends the tour.
 */
export function stepAfterMissing(
  index: number,
  direction: 1 | -1,
  total: number = TOUR_STEPS.length,
): { index: number; direction: 1 | -1 } | "finish" {
  const next = stepAfter(index, direction, total);
  if (next !== null) return { index: next, direction };
  if (direction === 1) return "finish";
  const forward = stepAfter(index, 1, total);
  return forward === null ? "finish" : { index: forward, direction: 1 };
}
