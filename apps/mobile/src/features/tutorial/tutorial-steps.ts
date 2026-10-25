/**
 * What the first-launch tutorial says, and when it is shown. Pure data and
 * decisions only: storage lives in use-tutorial-seen.ts, drawing in
 * TutorialSheet.tsx. The steps follow docs/flocka-v2-screen-spec.md section 1.
 */

/** One key per install. The version lets a future rewrite show it again. */
export const TUTORIAL_SEEN_KEY = "flocka-expo-tutorial-v1";
export const TUTORIAL_SEEN_VALUE = "1";

export type TutorialStep = {
  key: string;
  /** An icon name from components/text.tsx. */
  icon: string;
  title: string;
  lead: string;
};

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    key: "exchange",
    icon: "swap",
    title: "会った人と、カードを交換",
    lead: "近くの人はBluetoothで、そうでなければQRで、プレイヤーカードを見せ合います。",
  },
  {
    key: "give",
    icon: "spark",
    title: "印象や場面のメモを贈る",
    lead: "交換した相手に、その人の強みが見えた印象や場面を贈れます。",
  },
  {
    key: "guess",
    icon: "deck",
    title: "届いた封筒を予想して開ける",
    lead: "開ける前に、どの強みの証言か予想します。開けた証言はデッキに加わります。",
  },
  {
    key: "pr",
    icon: "doc",
    title: "2人の証言で、自己PRに",
    lead: "同じ強みに2人以上の証言がそろうと確認済みに。その証言から自己PRの下書きができます。",
  },
  {
    key: "privacy",
    icon: "shield",
    title: "公開範囲は自分で決める",
    lead: "受け取る証言の範囲は設定で選べます。ブロックや通報もできます。「自分のページ」の「公開範囲・安全」で変えられます。",
  },
];

/** True only for what this module wrote. Anything else counts as not seen. */
export function parseTutorialSeen(raw: string | null): boolean {
  return raw === TUTORIAL_SEEN_VALUE;
}

/**
 * What this device knows about the flag. `unknown` is a read that has not
 * finished or failed: a storage error must never show the tutorial again to
 * someone who may have seen it.
 */
export type TutorialSeenState = "unknown" | "seen" | "unseen";

export function shouldShowFirstLaunchTutorial({
  seen,
  signedIn,
  accountReady,
  onboarded,
  onboardingScreen,
}: {
  seen: TutorialSeenState;
  /** A real account is signed in. The signed-out scope never gets a tutorial. */
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

/** Steps clamp at both ends so a stray press cannot leave the list. */
export function stepAfter(index: number, direction: 1 | -1): number {
  return Math.min(Math.max(index + direction, 0), TUTORIAL_STEPS.length - 1);
}

export function isLastStep(index: number): boolean {
  return index >= TUTORIAL_STEPS.length - 1;
}
