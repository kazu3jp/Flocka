import { createUndoAction } from "./features/sync/undo-action";
import { keepIfSame } from "./features/sync/same-data";
import { forEachWithLimit } from "./features/sync/limited-concurrency";
import { userFacingError } from "./features/sync/user-facing-error";
import {
  useNotificationResponse,
  type NoticeKind,
} from "./features/notifications/use-notification-response";
import {
  forgetDeletedPushDevice,
  usePushRegistration,
} from "./features/notifications/use-push-registration";
import {
  planCachedPreferences,
  readPreferenceSyncMark,
  type PreferenceSyncMark,
} from "./features/sync/cached-preferences";
import { getApiClient } from "./features/auth/client";
import { useAuth } from "./features/auth/provider";
import { ApiClientError, sessionFailureKind } from "@flocka/api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useGlobalSearchParams,
  usePathname,
  useRouter,
  type Href,
} from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, BackHandler, Platform } from "react-native";
import {
  applySnapshot,
  preferencesOf,
  withPreferences,
  derive,
  fresh,
  initNav,
  restoreCachedNav,
  restoreCachedState,
  navigationForRoute,
  SCREENS,
  type Entry,
  type NavState,
  type ScreenId,
  type State,
  type Tab,
  type Profile,
  type Preferences,
  type RemotePlayer,
} from "@flocka/domain";

export const routeFor = (entry: Entry): Href => ({
  pathname: "/[page]",
  params: { page: entry.id, ...entry.params },
});
const CONFLICT_MESSAGE =
  "別の端末で更新されています。編集を比較して選択してください";
const DELETING_CLEANUP_FAILED =
  "このアカウントは削除を処理中ですが、この端末の保存データを消去できませんでした。アプリを再起動すると、もう一度消去します";
/** Typing in an editor changes the state on every key; coalesce the device writes. */
const STATE_WRITE_DELAY = 500;
/** Photo downloads per sync; enough to overlap latency without flooding the API. */
const PEER_AVATAR_CONCURRENCY = 4;
export const currentEntry = (n: NavState) =>
  n.stacks[n.tab][n.stacks[n.tab].length - 1];
type Toast = { text: string; action?: { label: string; fn: () => void } };
/** Forwards API session failures to whichever handler the provider set last. */
function createSessionFailureRelay() {
  let handler: (error: ApiClientError) => void = () => {};
  return {
    report: (error: ApiClientError) => handler(error),
    handleWith: (next: (error: ApiClientError) => void) => {
      handler = next;
    },
  };
}
type Navigation = {
  push: (id: ScreenId, params?: Record<string, string>) => void;
  replace: (id: ScreenId, params?: Record<string, string>) => void;
  pop: () => void;
  goTab: (tab: Tab, entry?: Entry, reset?: boolean) => void;
  root: () => void;
  reset: () => void;
};
type ContextValue = {
  s: State;
  d: ReturnType<typeof derive>;
  n: NavState;
  nav: Navigation;
  ready: boolean;
  error: string | null;
  saveError: string | null;
  syncError: string | null;
  peers: Record<string, RemotePlayer>;
  isAdmin: boolean;
  preferenceConflict: { data: Preferences; revision: number } | null;
  resolvePreferences: (choice: "server" | "local") => Promise<void>;
  reload: () => void;
  retrySave: () => void;
  clearDeletedAccount: () => Promise<void>;
  refresh: () => Promise<void>;
  savePreferences: () => Promise<void>;
  update: <R>(recipe: (draft: State) => R) => R;
  api: ReturnType<typeof getApiClient>;
  saveProfile: (profile: Profile, self: string[]) => Promise<void>;
  opening: string | null;
  setOpening: (id: string | null) => void;
  toast: (text: string, action?: Toast["action"]) => void;
  offerUndo: (
    text: string,
    undo: () => Promise<unknown>,
    successMessage: string,
  ) => void;
};
/** Status that changes on its own timer, kept apart so screens do not redraw with it. */
type StatusValue = {
  syncing: boolean;
  notification: Toast | null;
  dismissToast: () => void;
};
const Context = createContext<ContextValue | null>(null);
const StatusContext = createContext<StatusValue | null>(null);
export function Provider({
  children,
  storageScope,
}: {
  children: React.ReactNode;
  storageScope: string;
}) {
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const routeParams = JSON.stringify(
    Object.fromEntries(
      Object.entries(searchParams)
        .filter(([key, value]) => key !== "page" && typeof value === "string")
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
  const auth = useAuth();
  // The client lives as long as this scope; it reports to the latest handler.
  const [sessionFailures] = useState(createSessionFailureRelay);
  const router = useRouter(),
    [api] = useState(() =>
      getApiClient(
        storageScope === "signed-out" ? undefined : storageScope,
        sessionFailures.report,
      ),
    ),
    stateKey = `flocka-expo-state-v1:${storageScope}`,
    navKey = `flocka-expo-nav-v1:${storageScope}`,
    preferenceMarkKey = `flocka-expo-preferences-v1:${storageScope}`,
    [s, setS] = useState(fresh),
    [n, setN] = useState(initNav),
    [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saveError, setSaveError] = useState<string | null>(null),
    [syncError, setSyncError] = useState<string | null>(null),
    [syncing, setSyncing] = useState(false),
    [peers, setPeers] = useState<Record<string, RemotePlayer>>({}),
    [isAdmin, setIsAdmin] = useState(false),
    [preferenceConflict, setPreferenceConflict] = useState<{
      data: Preferences;
      revision: number;
    } | null>(null),
    [opening, setOpening] = useState<string | null>(null),
    [notification, setNotification] = useState<Toast | null>(null),
    [reloadKey, setReloadKey] = useState(0);
  const stateRef = useRef(s),
    navRef = useRef(n),
    mounted = useRef(true),
    prefsRevision = useRef(1),
    savedPreferences = useRef(JSON.stringify(preferencesOf(fresh()))),
    syncQueue = useRef(Promise.resolve()),
    saveQueue = useRef(Promise.resolve()),
    persistenceStopped = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    ownAvatar = useRef<{ version?: string | null; photo: string } | null>(null),
    peerPhotos = useRef(
      new Map<string, { version?: string | null; photo: string }>(),
    ),
    preferenceConflictRef = useRef<{
      data: Preferences;
      revision: number;
    } | null>(null),
    resolvingPreferences = useRef<Promise<void> | null>(null),
    cachedPreferences = useRef<{
      data: Preferences;
      revision: number;
      legacy: boolean;
    } | null>(null),
    stateWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pathnameRef = useRef(pathname),
    openingRef = useRef(opening),
    checkingSession = useRef(false);
  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    openingRef.current = opening;
  }, [pathname, opening]);
  useLayoutEffect(() => {
    if (!ready || !s.onboarded) return;
    const screen = pathname.slice(1) as ScreenId;
    // Onboarding is a one-time route, never an entry that a later launch reopens.
    if (!SCREENS.includes(screen) || screen === "onboarding") return;
    const next = navigationForRoute(navRef.current, {
      id: screen,
      params: JSON.parse(routeParams),
    });
    if (next !== navRef.current) {
      navRef.current = next;
      setN(next);
    }
  }, [pathname, routeParams, ready, s.onboarded]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const toast = useCallback((text: string, action?: Toast["action"]) => {
    if (timer.current) clearTimeout(timer.current);
    setNotification({ text, action });
    timer.current = setTimeout(
      () => setNotification(null),
      action ? 5000 : 2600,
    );
  }, []);
  const synchronize = useCallback(async () => {
    const snapshot = await api.getSnapshot();
    if (!mounted.current) return;
    // Photos are decoration: a missing or slow image keeps the previous photo
    // (or none) and never fails the sync of testimonies and exchanges.
    if (
      snapshot.player.profile.avatar.type === "photo" &&
      snapshot.player.avatarAvailable
    ) {
      if (
        ownAvatar.current?.version !== snapshot.player.avatarVersion ||
        !ownAvatar.current
      ) {
        const photo = await api.getAvatar().catch(() => null);
        if (photo !== null)
          ownAvatar.current = {
            version: snapshot.player.avatarVersion,
            photo,
          };
      }
      if (ownAvatar.current)
        snapshot.player.profile.avatar.photo = ownAvatar.current.photo;
    }
    const visiblePeers = snapshot.peers.filter(
      (peer) => !snapshot.blocked.includes(peer.id),
    );
    for (const id of peerPhotos.current.keys())
      if (!visiblePeers.some((peer) => peer.id === id))
        peerPhotos.current.delete(id);
    await forEachWithLimit(
      visiblePeers.filter(
        (peer) => peer.profile.avatar.type === "photo" && peer.avatarAvailable,
      ),
      PEER_AVATAR_CONCURRENCY,
      async (peer) => {
        let photo = peerPhotos.current.get(peer.id);
        if (!photo || photo.version !== peer.avatarVersion) {
          const loaded = await api.peerAvatar(peer.id).catch(() => null);
          if (loaded !== null) {
            photo = { version: peer.avatarVersion, photo: loaded };
            peerPhotos.current.set(peer.id, photo);
          }
        }
        if (photo) peer.profile.avatar.photo = photo.photo;
      },
    );
    if (!mounted.current) return;
    const dirty =
      JSON.stringify(preferencesOf(stateRef.current)) !==
      savedPreferences.current;
    const next = applySnapshot(snapshot, stateRef.current, dirty);
    if (dirty && snapshot.preferences.revision !== prefsRevision.current) {
      // Polling repeats the same conflict; keep it so the app does not redraw.
      const conflict = keepIfSame(
        preferenceConflictRef.current,
        snapshot.preferences,
      );
      if (conflict !== preferenceConflictRef.current) {
        preferenceConflictRef.current = conflict;
        setPreferenceConflict(conflict);
      }
      setSaveError(CONFLICT_MESSAGE);
    } else prefsRevision.current = snapshot.preferences.revision;
    if (!dirty) {
      savedPreferences.current = JSON.stringify(snapshot.preferences.data);
      // Nothing is left to compare once local edits match the server copy.
      if (preferenceConflictRef.current) {
        preferenceConflictRef.current = null;
        setPreferenceConflict(null);
        setSaveError((current) =>
          current === CONFLICT_MESSAGE ? null : current,
        );
      }
    }
    // Polling usually returns the same data; keep references so screens skip redrawing.
    stateRef.current = keepIfSame(stateRef.current, next);
    setS(stateRef.current);
    const nextPeers = Object.fromEntries(
      snapshot.peers.map((peer) => [peer.id, peer]),
    );
    setPeers((current) => keepIfSame(current, nextPeers));
    setIsAdmin(snapshot.isAdmin);
  }, [api]);
  const refresh = useCallback(() => {
    const task = syncQueue.current
      .catch(() => {})
      .then(async () => {
        if (!mounted.current || storageScope === "signed-out") return;
        setSyncing(true);
        try {
          await synchronize();
          if (mounted.current) setSyncError(null);
        } catch (error) {
          if (mounted.current)
            setSyncError(userFacingError(error, "同期に失敗しました"));
          throw error;
        } finally {
          if (mounted.current) setSyncing(false);
        }
      });
    syncQueue.current = task;
    return task;
  }, [storageScope, synchronize]);
  const offerUndo = useCallback(
    (text: string, undo: () => Promise<unknown>, successMessage: string) => {
      if (!mounted.current) return;
      toast(
        text,
        createUndoAction({
          undo,
          refresh,
          isActive: () => mounted.current,
          notify: toast,
          successMessage,
        }),
      );
    },
    [refresh, toast],
  );
  /**
   * Preferences left unsaved on this device (before sign-in, or when a session
   * ended) are sent on the server revision they were based on. Failing to send
   * them is reported but never blocks startup.
   */
  const uploadCachedPreferences = useCallback(async () => {
    const pending = cachedPreferences.current;
    if (!pending) return;
    const cached = pending.data;
    if (
      JSON.stringify(preferencesOf(stateRef.current)) !==
      savedPreferences.current
    ) {
      // Edits made since startup are newer than the cache and are saved by the normal flush.
      cachedPreferences.current = null;
      return;
    }
    try {
      let saved: Awaited<ReturnType<typeof api.savePreferences>>;
      try {
        saved = await api.savePreferences(cached, pending.revision);
      } catch (error) {
        if (!(
          error instanceof ApiClientError &&
          error.code === "PR_SOURCE_UNAVAILABLE" &&
          cached.prDraftSource
        ))
          throw error;
        // Keep the draft text, but stop attributing it to testimonies the server cannot verify.
        saved = await api.savePreferences(
          { ...cached, prDraftSource: null },
          pending.revision,
        );
      }
      cachedPreferences.current = null;
      if (!mounted.current) return;
      prefsRevision.current = saved.revision;
      savedPreferences.current = JSON.stringify(saved.data);
      stateRef.current = withPreferences(stateRef.current, saved.data);
      setS(stateRef.current);
      setSaveError(null);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        cachedPreferences.current = null;
        if (!mounted.current) return;
        if (pending.legacy) {
          // Another device saved first; its server copy supersedes this stale cache.
          setSaveError(null);
          toast("別の端末で保存された設定を使います");
          return;
        }
        // These are the user's own unsaved edits: keep them and offer the comparison.
        stateRef.current = withPreferences(stateRef.current, cached);
        setS(stateRef.current);
        prefsRevision.current = pending.revision;
        await synchronize().catch(() => {});
        return;
      }
      if (mounted.current)
        setSaveError(
          "この端末に残っていた設定をサーバーへ保存できませんでした。表示中の内容はサーバーのものです",
        );
    }
  }, [api, synchronize, toast]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [raw, rawNav, rawMark] = await Promise.all([
          AsyncStorage.getItem(stateKey),
          AsyncStorage.getItem(navKey),
          AsyncStorage.getItem(preferenceMarkKey),
        ]);
        if (!active) return;
        // Cached remote evidence is never used as authoritative data after sign-in.
        // An unreadable cache starts fresh because the server holds the real data.
        const cached = restoreCachedState(raw);
        stateRef.current = fresh();
        navRef.current = restoreCachedNav(rawNav);
        setN(navRef.current);
        if (storageScope !== "signed-out") {
          let registered = true;
          try {
            await synchronize();
          } catch (error) {
            if (!(
              error instanceof ApiClientError &&
              error.code === "PLAYER_NOT_FOUND"
            ))
              throw error;
            registered = false;
            stateRef.current = {
              ...fresh(),
              profile: cached.profile,
              self: cached.self,
            };
            setS(stateRef.current);
          }
          const plan =
            active && registered
              ? planCachedPreferences({
                  cached: preferencesOf(cached),
                  onboarded: cached.onboarded,
                  mark: readPreferenceSyncMark(rawMark),
                  server: {
                    data: preferencesOf(stateRef.current),
                    revision: prefsRevision.current,
                  },
                  defaults: preferencesOf(fresh()),
                })
              : ({ kind: "none" } as const);
          if (plan.kind === "upload") {
            cachedPreferences.current = plan;
            await uploadCachedPreferences();
          } else if (plan.kind === "conflict") {
            // Unsaved edits from an earlier session meet a newer server copy.
            preferenceConflictRef.current = {
              data: preferencesOf(stateRef.current),
              revision: prefsRevision.current,
            };
            setPreferenceConflict(preferenceConflictRef.current);
            stateRef.current = withPreferences(stateRef.current, plan.local);
            setS(stateRef.current);
            setSaveError(CONFLICT_MESSAGE);
          }
        }
        if (active) setReady(true);
      } catch (error) {
        if (active) setError(userFacingError(error, "読み込みに失敗しました"));
      }
    })();
    return () => {
      active = false;
    };
  }, [
    navKey,
    preferenceMarkKey,
    reloadKey,
    stateKey,
    storageScope,
    synchronize,
    uploadCachedPreferences,
  ]);
  useEffect(() => {
    if (!ready || !s.onboarded || storageScope === "signed-out") return;
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void refresh().catch(() => {});
    }, 15_000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh().catch(() => {});
    });
    return () => {
      clearInterval(interval);
      listener.remove();
    };
  }, [ready, s.onboarded, storageScope, refresh]);
  usePushRegistration(
    api,
    storageScope,
    ready && s.onboarded && storageScope !== "signed-out",
    toast,
  );
  const writeStorage = useCallback((entries: [string, string][]) => {
    if (persistenceStopped.current) return;
    saveQueue.current = saveQueue.current
      .then(() => AsyncStorage.multiSet(entries))
      .catch(() => {
        // Storage errors carry native details; the user only needs what to do next.
        if (mounted.current)
          setSaveError(
            "端末へ保存できませんでした。空き容量を確認して、もう一度お試しください",
          );
      });
  }, []);
  /** The state and the last server-confirmed preferences, so unsaved edits survive a sign-out. */
  const stateEntries = useCallback((): [string, string][] => {
    const mark: PreferenceSyncMark = {
      revision: prefsRevision.current,
      saved: JSON.parse(savedPreferences.current) as Preferences,
    };
    return [
      [stateKey, JSON.stringify(stateRef.current)],
      [preferenceMarkKey, JSON.stringify(mark)],
    ];
  }, [preferenceMarkKey, stateKey]);
  const writeStateNow = useCallback(() => {
    if (stateWriteTimer.current) clearTimeout(stateWriteTimer.current);
    stateWriteTimer.current = null;
    writeStorage(stateEntries());
  }, [stateEntries, writeStorage]);
  const persist = useCallback(() => {
    if (stateWriteTimer.current) clearTimeout(stateWriteTimer.current);
    stateWriteTimer.current = null;
    writeStorage([...stateEntries(), [navKey, JSON.stringify(navRef.current)]]);
  }, [navKey, stateEntries, writeStorage]);
  // Screen changes only rewrite navigation, not the whole state with its photos.
  useEffect(() => {
    if (!ready) return;
    if (stateWriteTimer.current) clearTimeout(stateWriteTimer.current);
    stateWriteTimer.current = setTimeout(writeStateNow, STATE_WRITE_DELAY);
  }, [s, ready, writeStateNow]);
  useEffect(() => {
    // A waiting write reaches the device before the app is suspended, or before
    // this provider unmounts when the account signs out or switches.
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active" && stateWriteTimer.current) writeStateNow();
    });
    return () => {
      listener.remove();
      if (stateWriteTimer.current) writeStateNow();
    };
  }, [writeStateNow]);
  useEffect(() => {
    if (ready) writeStorage([[navKey, JSON.stringify(n)]]);
  }, [n, ready, navKey, writeStorage]);
  const flushPreferences = useCallback(() => {
    const task = syncQueue.current
      .catch(() => {})
      .then(async () => {
        const data = preferencesOf(stateRef.current),
          json = JSON.stringify(data);
        if (
          !mounted.current ||
          json === savedPreferences.current ||
          !stateRef.current.onboarded
        )
          return;
        // Saving over an unresolved conflict would overwrite the other device's edit.
        if (preferenceConflictRef.current) throw new Error(CONFLICT_MESSAGE);
        try {
          const saved = await api.savePreferences(data, prefsRevision.current);
          if (!mounted.current) return;
          prefsRevision.current = saved.revision;
          savedPreferences.current = json;
          // Newer local edits supersede preferences cached before sign-in.
          cachedPreferences.current = null;
          setSaveError(null);
          writeStateNow();
        } catch (error) {
          if (mounted.current)
            setSaveError(
              userFacingError(error, "サーバーへ保存できませんでした"),
            );
          if (error instanceof ApiClientError && error.status === 409) {
            // Fetch the conflicting revision before offering the comparison UI.
            await synchronize().catch(() => {});
          }
          throw error;
        }
      });
    syncQueue.current = task;
    return task;
  }, [api, synchronize, writeStateNow]);
  const resolvePreferences = useCallback(
    (choice: "server" | "local") => {
      // A second tap while saving joins the running resolution instead of saving twice.
      if (resolvingPreferences.current) return resolvingPreferences.current;
      const task = syncQueue.current
        .catch(() => {})
        .then(async () => {
          const conflict = preferenceConflictRef.current;
          if (!conflict || !mounted.current) return;
          if (choice === "server") {
            stateRef.current = withPreferences(stateRef.current, conflict.data);
            setS(stateRef.current);
            prefsRevision.current = conflict.revision;
            savedPreferences.current = JSON.stringify(conflict.data);
          } else {
            const data = preferencesOf(stateRef.current);
            try {
              const saved = await api.savePreferences(data, conflict.revision);
              prefsRevision.current = saved.revision;
              savedPreferences.current = JSON.stringify(data);
            } catch (error) {
              if (error instanceof ApiClientError && error.status === 409)
                // The server changed again; refresh the comparison before the next choice.
                await synchronize().catch(() => {});
              throw new Error(
                userFacingError(error, "サーバーへ保存できませんでした"),
              );
            }
          }
          if (!mounted.current) return;
          preferenceConflictRef.current = null;
          setPreferenceConflict(null);
          setSaveError(null);
        })
        .finally(() => {
          resolvingPreferences.current = null;
        });
      resolvingPreferences.current = task;
      syncQueue.current = task;
      return task;
    },
    [api, synchronize],
  );
  const derived = useMemo(() => derive(s), [s]);
  const preferencesJson = useMemo(() => JSON.stringify(preferencesOf(s)), [s]);
  useEffect(() => {
    // Automatic saving waits while the user compares a conflicting edit.
    if (
      !ready ||
      !s.onboarded ||
      preferenceConflict ||
      preferencesJson === savedPreferences.current
    )
      return;
    const timer = setTimeout(
      () => void flushPreferences().catch(() => {}),
      700,
    );
    return () => clearTimeout(timer);
  }, [
    ready,
    s.onboarded,
    preferenceConflict,
    preferencesJson,
    flushPreferences,
  ]);
  const update = useCallback(<R,>(recipe: (draft: State) => R): R => {
    const next = JSON.parse(JSON.stringify(stateRef.current)) as State;
    const result = recipe(next);
    stateRef.current = next;
    setS(next);
    return result;
  }, []);
  const saveProfile = useCallback(
    async (profile: Profile, self: string[]) => {
      // Profile edits keep the synced photo; only a changed photo is uploaded.
      if (
        profile.avatar.type === "photo" &&
        profile.avatar.photo &&
        profile.avatar.photo !== ownAvatar.current?.photo
      ) {
        await api.uploadAvatar(profile.avatar.photo);
        ownAvatar.current = { version: null, photo: profile.avatar.photo };
      }
      await api.updateProfile(profile, self);
      await refresh();
    },
    [api, refresh],
  );
  const openNotification = useCallback(
    async (kind: NoticeKind) => {
      await refresh();
      if (!mounted.current) return;
      const next = initNav();
      if (kind === "exchange") {
        next.tab = "exchange";
        next.stacks.exchange.push({ id: "connections" });
      } else {
        next.stacks.find.push({
          id: kind === "moderation" ? "settings" : "pieces",
        });
      }
      navRef.current = next;
      setN(next);
      router.replace(routeFor(currentEntry(next)));
    },
    [refresh, router],
  );
  useNotificationResponse(
    storageScope,
    ready && s.onboarded,
    openNotification,
    toast,
  );
  const commitNav = useCallback(
    (next: NavState) => {
      navRef.current = next;
      setN(next);
      router.replace(routeFor(currentEntry(next)));
    },
    [router],
  );
  const nav = useMemo<Navigation>(() => {
    const mutateNav = (recipe: (next: NavState) => void) => {
      const next = JSON.parse(JSON.stringify(navRef.current)) as NavState;
      recipe(next);
      commitNav(next);
    };
    return {
      push: (id, params) =>
        mutateNav((v) => v.stacks[v.tab].push({ id, params })),
      replace: (id, params) =>
        mutateNav((v) => {
          v.stacks[v.tab][v.stacks[v.tab].length - 1] = { id, params };
        }),
      pop: () =>
        mutateNav((v) => {
          if (v.stacks[v.tab].length > 1) v.stacks[v.tab].pop();
        }),
      goTab: (tab, entry, reset = false) =>
        mutateNav((v) => {
          if (reset || entry) v.stacks[tab] = initNav().stacks[tab];
          v.tab = tab;
          if (entry) v.stacks[tab].push(entry);
        }),
      root: () =>
        mutateNav((v) => {
          v.stacks[v.tab] = initNav().stacks[v.tab];
        }),
      reset: () => commitNav(initNav()),
    };
  }, [commitNav]);
  // Registered once, so screen-level back steps added later are asked first.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      // Auth and account routes outside the tab screens handle back themselves.
      if (!SCREENS.includes(pathnameRef.current.slice(1) as ScreenId))
        return false;
      if (openingRef.current) {
        setOpening(null);
        return true;
      }
      if (navRef.current.stacks[navRef.current.tab].length > 1) {
        const next = JSON.parse(JSON.stringify(navRef.current)) as NavState;
        next.stacks[next.tab].pop();
        commitNav(next);
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [commitNav]);
  const reload = useCallback(() => {
    setReady(false);
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);
  const clearDeletedAccount = useCallback(async () => {
    persistenceStopped.current = true;
    if (stateWriteTimer.current) clearTimeout(stateWriteTimer.current);
    stateWriteTimer.current = null;
    await saveQueue.current;
    await forgetDeletedPushDevice(storageScope);
    await AsyncStorage.multiRemove([stateKey, navKey, preferenceMarkKey]);
    ownAvatar.current = null;
    peerPhotos.current.clear();
    cachedPreferences.current = null;
    stateRef.current = fresh();
    navRef.current = initNav();
  }, [navKey, preferenceMarkKey, stateKey, storageScope]);
  // The server rejected this session: re-check it, so a signed-out or switched
  // account leaves this scope. Unsaved edits stay on the device for that account.
  useEffect(() => {
    sessionFailures.handleWith((failure) => {
      if (
        sessionFailureKind(failure) === "account-deleting" &&
        !persistenceStopped.current
      )
        // Another device deleted this account; nothing here is kept for it.
        void clearDeletedAccount().catch(() => {
          if (mounted.current) setError(DELETING_CLEANUP_FAILED);
        });
      if (checkingSession.current) return;
      checkingSession.current = true;
      void auth.refetch().finally(() => {
        checkingSession.current = false;
      });
    });
  }, [auth, clearDeletedAccount, sessionFailures]);
  const retrySave = useCallback(() => {
    persist();
    if (cachedPreferences.current)
      syncQueue.current = syncQueue.current
        .catch(() => {})
        .then(uploadCachedPreferences);
    void flushPreferences().catch(() => {});
  }, [flushPreferences, persist, uploadCachedPreferences]);
  const dismissToast = useCallback(() => setNotification(null), []);
  const value = useMemo<ContextValue>(
    () => ({
      s,
      d: derived,
      n,
      nav,
      ready,
      error,
      saveError,
      syncError,
      peers,
      isAdmin,
      preferenceConflict,
      resolvePreferences,
      api,
      refresh,
      savePreferences: flushPreferences,
      saveProfile,
      update,
      reload,
      clearDeletedAccount,
      retrySave,
      opening,
      setOpening,
      toast,
      offerUndo,
    }),
    [
      s,
      derived,
      n,
      nav,
      ready,
      error,
      saveError,
      syncError,
      peers,
      isAdmin,
      preferenceConflict,
      resolvePreferences,
      api,
      refresh,
      flushPreferences,
      saveProfile,
      update,
      reload,
      clearDeletedAccount,
      retrySave,
      opening,
      toast,
      offerUndo,
    ],
  );
  const status = useMemo<StatusValue>(
    () => ({ syncing, notification, dismissToast }),
    [syncing, notification, dismissToast],
  );
  return (
    <Context.Provider value={value}>
      <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
    </Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) throw new Error("Flocka Provider is missing");
  return context;
}
export function useAppStatus() {
  const context = useContext(StatusContext);
  if (!context) throw new Error("Flocka Provider is missing");
  return context;
}
