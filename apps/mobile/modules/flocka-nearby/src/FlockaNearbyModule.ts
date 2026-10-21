import { NativeModule, requireOptionalNativeModule } from "expo";
import type {
  FlockaNearbyModuleEvents,
  NearbyPermissions,
} from "./FlockaNearby.types";
declare class FlockaNearbyModule extends NativeModule<FlockaNearbyModuleEvents> {
  requestPermissions(): Promise<NearbyPermissions>;
  start(code: string): Promise<void>;
  stop(): Promise<void>;
}
export default requireOptionalNativeModule<FlockaNearbyModule>("FlockaNearby");
