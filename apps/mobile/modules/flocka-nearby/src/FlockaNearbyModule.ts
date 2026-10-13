import { NativeModule, requireOptionalNativeModule } from "expo";
import type { FlockaNearbyModuleEvents } from "./FlockaNearby.types";
declare class FlockaNearbyModule extends NativeModule<FlockaNearbyModuleEvents> {
  requestPermissions(): Promise<{ granted: boolean }>;
  start(code: string): Promise<void>;
  stop(): Promise<void>;
}
export default requireOptionalNativeModule<FlockaNearbyModule>("FlockaNearby");
