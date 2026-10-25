// Decides what the QR scan tab shows from the camera permission. Pure so the
// rules are tested without a device (see tests/camera-permission.test.ts).

export type CameraPermissionInput = {
  // null while the permission has not been read yet.
  status: "undetermined" | "granted" | "denied" | null;
  canAskAgain: boolean;
  // The last requestPermission() call threw instead of answering.
  requestFailed: boolean;
  requesting: boolean;
};

export type CameraPermissionView =
  | "checking" // reading or waiting for the system answer
  | "request" // never asked: ask now
  | "granted" // show the camera
  | "retry" // denied, the system prompt can still be shown
  | "settings" // denied for good: only the system settings can change it
  | "error"; // the request itself failed; never treated as granted

export function cameraPermissionView(
  input: CameraPermissionInput,
): CameraPermissionView {
  if (input.status === "granted") return "granted";
  if (input.requesting || input.status === null) return "checking";
  if (input.requestFailed) return "error";
  if (input.status === "undetermined") return "request";
  return input.canAskAgain ? "retry" : "settings";
}

// Only the first look at an undetermined permission asks on its own; after a
// failure the person decides with the button.
export function shouldAutoRequestCamera(
  view: CameraPermissionView,
  alreadyAsked: boolean,
): boolean {
  return view === "request" && !alreadyAsked;
}

export const CAMERA_PERMISSION_COPY: Record<
  Exclude<CameraPermissionView, "granted">,
  { message: string; button: string | null }
> = {
  checking: { message: "カメラの許可を確認しています…", button: null },
  request: {
    message:
      "相手の交換用QRを読み取るためにカメラを使います。次に出る確認で「許可」を選んでください。",
    button: "カメラを許可する",
  },
  retry: {
    message:
      "カメラが許可されていないため読み取れません。もう一度許可を求めます。",
    button: "もう一度許可を求める",
  },
  settings: {
    message:
      "カメラの許可が拒否されています。端末の設定でFlockaのカメラを許可してから、この画面に戻ってください。",
    button: "設定を開く",
  },
  error: {
    message: "カメラの許可を確認できませんでした。もう一度お試しください。",
    button: "もう一度許可を求める",
  },
};
