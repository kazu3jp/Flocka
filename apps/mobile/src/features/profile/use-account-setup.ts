import { useCallback, useRef } from "react";
import type { Profile } from "@flocka/domain";
import { useApp } from "../../store";

/**
 * The server steps that finish onboarding: accept the terms, create the
 * account, upload the photo and save the profile. A retry after a later step
 * failed skips the account creation that already succeeded.
 */
export function useAccountSetup() {
  const { api } = useApp();
  const accountCreated = useRef(false);
  return useCallback(
    async (input: Profile, self: string[], termsAccepted: boolean) => {
      if (!accountCreated.current) {
        if (!termsAccepted) await api.acceptTerms();
        await api.createAccount(
          input.avatar.type === "photo"
            ? {
                ...input,
                avatar: { ...input.avatar, type: "initial", photo: undefined },
              }
            : input,
          self,
        );
        accountCreated.current = true;
      }
      // The account exists from here on. A photo that fails to upload must not
      // undo it: finish with an initial avatar and offer to send the photo again.
      let saved = input;
      let photoFailed = false;
      if (input.avatar.type === "photo" && input.avatar.photo)
        try {
          await api.uploadAvatar(input.avatar.photo);
        } catch {
          photoFailed = true;
          saved = { ...input, avatar: { ...input.avatar, type: "initial" } };
        }
      await api.updateProfile(saved, self);
      return { saved, photoFailed };
    },
    [api],
  );
}
