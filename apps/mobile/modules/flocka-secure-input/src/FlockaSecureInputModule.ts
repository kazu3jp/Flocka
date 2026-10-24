import { NativeModule, requireOptionalNativeModule } from "expo";

declare class FlockaSecureInputModule extends NativeModule {
  hideTypedCharacters(viewTag: number): Promise<void>;
}
/** Android only; null elsewhere, where password fields never reveal characters. */
export default requireOptionalNativeModule<FlockaSecureInputModule>(
  "FlockaSecureInput",
);
