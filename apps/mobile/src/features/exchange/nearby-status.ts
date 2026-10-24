/**
 * What the nearby screen shows, decided only from signals that really happen:
 * the platform, the native module, the start request, the native `onReady`,
 * radio errors and screen focus. Nothing here guesses that scanning is live.
 */
export type NearbyStatus =
  "unsupported" | "preparing" | "searching" | "found" | "paused" | "blocked";

export type NearbyStatusInput = {
  /** False on the web, where there is no Bluetooth. */
  supported: boolean;
  /** False in Expo Go or any build without the native module. */
  hasModule: boolean;
  /** The invite is loading or `start()` has been requested and not answered. */
  starting: boolean;
  /** Scanning is really running: `start()` resolved or the native `onReady` came. */
  ready: boolean;
  /** A radio error, a permission refusal or an invite failure is active. */
  error: boolean;
  peerCount: number;
  focused: boolean;
};

/** Zero peers for this long while scanning shows the tips and the QR link. */
export const NEARBY_TIPS_AFTER_MS = 12_000;

export function nearbyStatus(input: NearbyStatusInput): NearbyStatus {
  if (!input.supported || !input.hasModule) return "unsupported";
  if (input.error) return "blocked";
  if (!input.focused) return "paused";
  if (!input.ready) return input.starting ? "preparing" : "paused";
  return input.peerCount > 0 ? "found" : "searching";
}

/** Only these states have radio activity worth animating. */
export const isScanning = (status: NearbyStatus) =>
  status === "searching" || status === "found";

export type NearbyCopy = { label: string; hint: string; spoken: string };

export function nearbyCopy(
  status: NearbyStatus,
  peerCount: number,
): NearbyCopy {
  switch (status) {
    case "searching":
      return {
        label: "近くの人を探しています…",
        hint: "相手にも、この画面を開いてもらってください",
        spoken: "探索中、まだ誰も見つかっていません",
      };
    case "found":
      return {
        label: `${peerCount}人見つかりました`,
        hint: "名前をタップすると交換を始めます",
        spoken: `探索中、${peerCount}人見つかりました`,
      };
    case "preparing":
      return {
        label: "準備しています…",
        hint: "Bluetoothの許可と接続を確認しています",
        spoken: "探索の準備中",
      };
    case "paused":
      return {
        label: "探索を一時停止しています",
        hint: "この画面に戻ると探索を再開します",
        spoken: "探索は一時停止中",
      };
    case "blocked":
      return { label: "探索できません", hint: "", spoken: "探索できません" };
    case "unsupported":
      return {
        label: "ここでは近くの人を探せません",
        hint: "",
        spoken: "この環境では近くの人を探せません",
      };
  }
}

/** The empty-state tips appear after a quiet stretch of real scanning. */
export const showsNearbyTips = (status: NearbyStatus, searchedMs: number) =>
  status === "searching" && searchedMs >= NEARBY_TIPS_AFTER_MS;
