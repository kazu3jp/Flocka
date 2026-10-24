type Permissions = { granted: boolean; canAskAgain: boolean };
type Radio = {
  requestPermissions: () => Promise<Permissions>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onStarting: (starting: boolean) => void;
  onReady: (ready: boolean) => void;
  onDenied: (permissions: Permissions) => void;
  onError: (error: unknown) => void;
};

/** One screen visit owns one radio. Permission activities may background Android. */
export function createNearbyRadioSession(radio: Radio, foreground = true) {
  let active = true;
  let inForeground = foreground;
  let starting = false;
  let requested = false;
  let resumeNeeded = !foreground;
  let generation = 0;
  let stopped = Promise.resolve();

  const stop = () => {
    if (!requested) return;
    requested = false;
    // A restart must wait for the previous native stop, not race it.
    stopped = stopped.then(() => radio.stop()).catch(() => {});
  };

  const start = () => {
    if (!active || !inForeground || starting) return;
    starting = true;
    resumeNeeded = false;
    radio.onStarting(true);
    void (async () => {
      try {
        await stopped;
        if (!active || !inForeground) return;
        const permissions = await radio.requestPermissions();
        if (!active) return;
        if (!permissions.granted) {
          resumeNeeded = false;
          radio.onDenied(permissions);
          return;
        }
        if (!inForeground) return;
        // A permission activity may have returned while this attempt was pending.
        // It needs no second request: continue this attempt with the real result.
        resumeNeeded = false;
        const attempt = generation;
        requested = true;
        await radio.start();
        if (active && inForeground && generation === attempt)
          radio.onReady(true);
      } catch (error) {
        if (!active) return;
        const cancelled =
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "CANCELLED";
        if (!cancelled) {
          resumeNeeded = false;
          radio.onError(error);
        }
      } finally {
        starting = false;
        if (active) {
          radio.onStarting(false);
          if (resumeNeeded && inForeground) start();
        }
      }
    })();
  };

  return {
    start,
    background() {
      if (!active) return;
      inForeground = false;
      resumeNeeded = true;
      generation++;
      radio.onReady(false);
      // Do not stop a radio that hasn't started while a permission UI is open.
      stop();
    },
    foreground() {
      if (!active) return;
      inForeground = true;
      if (resumeNeeded) start();
    },
    ready() {
      if (active && inForeground && requested) radio.onReady(true);
    },
    dispose() {
      active = false;
      generation++;
      stop();
    },
  };
}
