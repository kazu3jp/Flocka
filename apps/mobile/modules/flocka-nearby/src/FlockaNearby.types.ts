export type NearbyPeer = { deviceId: string; code: string; rssi: number };
export type FlockaNearbyModuleEvents = {
  onPeer: (peer: NearbyPeer) => void;
  onError: (error: { message: string }) => void;
};
