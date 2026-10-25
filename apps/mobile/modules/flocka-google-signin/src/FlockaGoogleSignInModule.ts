import { NativeModule, requireOptionalNativeModule } from "expo";

declare class FlockaGoogleSignInModule extends NativeModule {
  signIn(webClientId: string, nonce: string): Promise<string>;
}
/** Android only; null on web and iOS, which keep the browser sign-in. */
export default requireOptionalNativeModule<FlockaGoogleSignInModule>(
  "FlockaGoogleSignIn",
);
