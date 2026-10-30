export type NearbyPeer = { deviceId: string; code: string; rssi: number };
/**
 * Codes used by `start()` rejections and `onError` events.
 * `BLUETOOTH_OFF` and `LOCATION_OFF` pause the session: the native side keeps it
 * and sends `onReady` once advertising and scanning run again. Other codes end it.
 * `CANCELLED` only comes from our own `stop()` or a newer `start()`.
 */
export type NearbyErrorCode =
  | "PERMISSION_DENIED"
  | "BLUETOOTH_OFF"
  | "LOCATION_OFF"
  | "UNSUPPORTED"
  | "CANCELLED"
  | "INVALID_CODE"
  | "PERMISSIONS_UNAVAILABLE"
  | "BLUETOOTH_FAILED";
export type NearbyError = { code: NearbyErrorCode; message: string };
export type NearbyPermissions = { granted: boolean; canAskAgain: boolean };
export type FlockaNearbyModuleEvents = {
  onPeer: (peer: NearbyPeer) => void;
  /** A connected peer saved an exchange; JS must verify it with the API. */
  onExchangeStarted: (signal: { code: string; exchangeId: string }) => void;
  onError: (error: NearbyError) => void;
  /** Advertising and scanning resumed after a pause, without a new `start()`. */
  onReady: () => void;
};
