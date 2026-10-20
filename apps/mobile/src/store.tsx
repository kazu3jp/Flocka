import { createUndoAction } from "./features/sync/undo-action";
import {
  useNotificationResponse,
  type NoticeKind,
} from "./features/notifications/use-notification-response";
import {
  forgetDeletedPushDevice,
  usePushRegistration,
} from "./features/notifications/use-push-registration";
import { getApiClient } from "./features/auth/client";
import { ApiClientError } from "@flocka/api-client";
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
  restoreState,
  validNav,
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
export const currentEntry = (n: NavState) =>
  n.stacks[n.tab][n.stacks[n.tab].length - 1];
type Toast = { text: string; action?: { label: string; fn: () => void } };
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
  syncing: boolean;
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
  notification: Toast | null;
  dismissToast: () => void;
};
const Context = createContext<ContextValue | null>(null);
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
  const router = useRouter(),
    [api] = useState(() =>
      getApiClient(storageScope === "signed-out" ? undefined : storageScope),
    ),
    stateKey = `flocka-expo-state-v1:${storageScope}`,
    navKey = `flocka-expo-nav-v1:${storageScope}`,
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
    );
  useLayoutEffect(() => {
    if (!ready || !s.onboarded) return;
    const screen = pathname.slice(1) as ScreenId;
    if (!SCREENS.includes(screen)) return;
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
    if (
      snapshot.player.profile.avatar.type === "photo" &&
      snapshot.player.avatarAvailable
    ) {
      if (
        ownAvatar.current?.version !== snapshot.player.avatarVersion ||
        !ownAvatar.current
      )
        ownAvatar.current = {
          version: snapshot.player.avatarVersion,
          photo: await api.getAvatar(),
        };
      snapshot.player.profile.avatar.photo = ownAvatar.current.photo;
    }
    for (const peer of snapshot.peers) {
      if (
        peer.profile.avatar.type !== "photo" ||
        !peer.avatarAvailable ||
        snapshot.blocked.includes(peer.id)
      )
        continue;
      let photo = peerPhotos.current.get(peer.id);
      if (!photo || photo.version !== peer.avatarVersion) {
        try {
          photo = {
            version: peer.avatarVersion,
            photo: await api.peerAvatar(peer.id),
          };
          peerPhotos.current.set(peer.id, photo);
        } catch (error) {
          if (!(error instanceof ApiClientError && error.status === 404))
            throw error;
        }
      }
      if (photo) peer.profile.avatar.photo = photo.photo;
    }
    if (!mounted.current) return;
    const dirty =
      JSON.stringify(preferencesOf(stateRef.current)) !==
      savedPreferences.current;
    const next = applySnapshot(snapshot, stateRef.current, dirty);
    if (dirty && snapshot.preferences.revision !== prefsRevision.current) {
      setPreferenceConflict(snapshot.preferences);
      setSaveError(
        "別の端末で更新されています。編集を比較して選択してください",
      );
    } else prefsRevision.current = snapshot.preferences.revision;
    if (!dirty)
      savedPreferences.current = JSON.stringify(snapshot.preferences.data);
    stateRef.current = next;
    setS(next);
    setPeers(Object.fromEntries(snapshot.peers.map((peer) => [peer.id, peer])));
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
            setSyncError(
              error instanceof Error ? error.message : "同期に失敗しました",
            );
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
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [raw, rawNav] = await Promise.all([
          AsyncStorage.getItem(stateKey),
          AsyncStorage.getItem(navKey),
        ]);
        if (!active) return;
        // Cached remote evidence is never used as authoritative data after sign-in.
        const cached = restoreState(raw),
          navigation = rawNav ? JSON.parse(rawNav) : null;
        stateRef.current = fresh();
        navRef.current = validNav(navigation) ? navigation : initNav();
        setN(navRef.current);
        if (storageScope !== "signed-out") {
          try {
            await synchronize();
            if (
              cached.onboarded &&
              prefsRevision.current === 1 &&
              savedPreferences.current ===
                JSON.stringify(preferencesOf(fresh())) &&
              JSON.stringify(preferencesOf(cached)) !== savedPreferences.current
            ) {
              const saved = await api.savePreferences(preferencesOf(cached), 1);
              prefsRevision.current = saved.revision;
              savedPreferences.current = JSON.stringify(saved.data);
              stateRef.current = withPreferences(stateRef.current, saved.data);
              setS(stateRef.current);
            }
          } catch (error) {
            if (!(
              error instanceof ApiClientError &&
              error.code === "PLAYER_NOT_FOUND"
            ))
              throw error;
            stateRef.current = {
              ...fresh(),
              profile: cached.profile,
              self: cached.self,
            };
            setS(stateRef.current);
          }
        }
        if (active) setReady(true);
      } catch (error) {
        if (active)
          setError(
            error instanceof Error ? error.message : "読み込みに失敗しました",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [api, navKey, reloadKey, stateKey, storageScope, synchronize]);
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
  const persist = useCallback(() => {
    if (persistenceStopped.current) return;
    const state = JSON.stringify(stateRef.current),
      navigation = JSON.stringify(navRef.current);
    saveQueue.current = saveQueue.current
      .then(() =>
        AsyncStorage.multiSet([
          [stateKey, state],
          [navKey, navigation],
        ]),
      )
      .catch((error) => {
        if (mounted.current)
          setSaveError(
            `端末へ保存できませんでした：${String(error.message || error)}`,
          );
      });
  }, [navKey, stateKey]);
  useEffect(() => {
    if (ready) persist();
  }, [s, n, ready, persist]);
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
        try {
          const saved = await api.savePreferences(data, prefsRevision.current);
          if (!mounted.current) return;
          prefsRevision.current = saved.revision;
          savedPreferences.current = json;
          setSaveError(null);
        } catch (error) {
          if (mounted.current)
            setSaveError(
              error instanceof Error
                ? error.message
                : "サーバーへ保存できませんでした",
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
  }, [api, synchronize]);
  const resolvePreferences = async (choice: "server" | "local") => {
    if (!preferenceConflict) return;
    if (choice === "server") {
      stateRef.current = withPreferences(
        stateRef.current,
        preferenceConflict.data,
      );
      setS(stateRef.current);
      prefsRevision.current = preferenceConflict.revision;
      savedPreferences.current = JSON.stringify(preferenceConflict.data);
    } else {
      const data = preferencesOf(stateRef.current),
        saved = await api.savePreferences(data, preferenceConflict.revision);
      prefsRevision.current = saved.revision;
      savedPreferences.current = JSON.stringify(data);
    }
    setPreferenceConflict(null);
    setSaveError(null);
  };
  const derived = useMemo(() => derive(s), [s]);
  const preferencesJson = JSON.stringify(preferencesOf(s));
  useEffect(() => {
    if (!ready || !s.onboarded || preferencesJson === savedPreferences.current)
      return;
    const timer = setTimeout(
      () => void flushPreferences().catch(() => {}),
      700,
    );
    return () => clearTimeout(timer);
  }, [ready, s.onboarded, preferencesJson, flushPreferences]);
  const update = <R,>(recipe: (draft: State) => R): R => {
    const next = JSON.parse(JSON.stringify(stateRef.current)) as State;
    const result = recipe(next);
    stateRef.current = next;
    setS(next);
    return result;
  };
  const saveProfile = async (profile: Profile, self: string[]) => {
    if (profile.avatar.type === "photo" && profile.avatar.photo)
      await api.uploadAvatar(profile.avatar.photo);
    await api.updateProfile(profile, self);
    await refresh();
  };
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
  const commitNav = (next: NavState) => {
    navRef.current = next;
    setN(next);
    router.replace(routeFor(currentEntry(next)));
  };
  const mutateNav = (recipe: (next: NavState) => void) => {
    const next = JSON.parse(JSON.stringify(navRef.current)) as NavState;
    recipe(next);
    commitNav(next);
  };
  const nav: Navigation = {
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
  useEffect(() => {
    if (Platform.OS === "web") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (opening) {
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
    // The listener reads the current navigation through its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening]);
  return (
    <Context.Provider
      value={{
        s,
        d: derived,
        n,
        nav,
        ready,
        error,
        saveError,
        syncError,
        syncing,
        peers,
        isAdmin,
        preferenceConflict,
        resolvePreferences,
        api,
        refresh,
        savePreferences: flushPreferences,
        saveProfile,
        update,
        reload: () => {
          setReady(false);
          setError(null);
          setReloadKey((key) => key + 1);
        },
        clearDeletedAccount: async () => {
          persistenceStopped.current = true;
          await saveQueue.current;
          await forgetDeletedPushDevice(storageScope);
          await AsyncStorage.multiRemove([stateKey, navKey]);
          ownAvatar.current = null;
          peerPhotos.current.clear();
          stateRef.current = fresh();
          navRef.current = initNav();
        },
        retrySave: () => {
          persist();
          void flushPreferences().catch(() => {});
        },
        opening,
        setOpening,
        toast,
        offerUndo,
        notification,
        dismissToast: () => setNotification(null),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) throw new Error("Flocka Provider is missing");
  return context;
}
