/**
 * Lets through only a device push token that differs from the last one seen.
 * On Android, expo-notifications reports the token again after every fetch,
 * and registering fetches it, so passing repeats on would register forever.
 */
export function createDeviceTokenChangeFilter() {
  let last: string | null = null;
  return {
    /** Records a token this device just used, so its echo is not a change. */
    remember(token: string) {
      last = token;
    },
    /** True only for a token not seen before; it becomes the last one. */
    changed(token: string) {
      if (token === last) return false;
      last = token;
      return true;
    },
  };
}
