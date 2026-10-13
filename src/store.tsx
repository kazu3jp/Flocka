import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, type Href } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { BackHandler, Platform } from "react-native";
import {
  demoState,
  derive,
  fresh,
  initNav,
  restoreState,
  validNav,
  type Entry,
  type NavState,
  type ScreenId,
  type State,
  type Tab,
} from "./model";

const STATE_KEY = "flocka-expo-state-v1",
  NAV_KEY = "flocka-expo-nav-v1";
export const routeFor = (entry: Entry): Href => ({
  pathname: "/[screen]",
  params: { screen: entry.id, ...entry.params },
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
  reload: () => void;
  retrySave: () => void;
  update: <R>(recipe: (draft: State) => R) => R;
  loadDemo: () => void;
  exitDemo: () => void;
  demo: boolean;
  opening: string | null;
  setOpening: (id: string | null) => void;
  toast: (text: string, action?: Toast["action"]) => void;
  notification: Toast | null;
  dismissToast: () => void;
};
const Context = createContext<ContextValue | null>(null);
export function Provider({ children }: { children: React.ReactNode }) {
  const router = useRouter(),
    [s, setS] = useState(fresh),
    [n, setN] = useState(initNav),
    [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saveError, setSaveError] = useState<string | null>(null),
    [opening, setOpening] = useState<string | null>(null),
    [notification, setNotification] = useState<Toast | null>(null),
    [reloadKey, setReloadKey] = useState(0);
  const stateRef = useRef(s),
    navRef = useRef(n),
    saveQueue = useRef(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoRef = useRef(false);
  const [demo, setDemo] = useState(false),
    backup = useRef<{ s: State; n: NavState } | null>(null);
  const toast = useCallback((text: string, action?: Toast["action"]) => {
    if (timer.current) clearTimeout(timer.current);
    setNotification({ text, action });
    timer.current = setTimeout(
      () => setNotification(null),
      action ? 5000 : 2600,
    );
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(STATE_KEY),
      AsyncStorage.getItem(NAV_KEY),
    ])
      .then(([raw, navRaw]) => {
        if (!active) return;
        const state = restoreState(raw);
        const savedNav = navRaw ? JSON.parse(navRaw) : null;
        const navigation = validNav(savedNav) ? savedNav : initNav();
        stateRef.current = state;
        navRef.current = navigation;
        setS(state);
        setN(navigation);
        setReady(true);
      })
      .catch((e) => {
        if (active)
          setError(`読み込みに失敗しました: ${String(e.message || e)}`);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);
  const persist = useCallback(() => {
    if (demoRef.current) return;
    const state = JSON.stringify(stateRef.current),
      navigation = JSON.stringify(navRef.current);
    saveQueue.current = saveQueue.current
      .then(() =>
        AsyncStorage.multiSet([
          [STATE_KEY, state],
          [NAV_KEY, navigation],
        ]),
      )
      .then(() => setSaveError(null))
      .catch((e) => {
        setSaveError(`保存できませんでした: ${String(e.message || e)}`);
      });
  }, []);
  useEffect(() => {
    if (ready && !demo) persist();
  }, [s, n, ready, demo, persist]);
  const update = <R,>(recipe: (draft: State) => R): R => {
    const next = JSON.parse(JSON.stringify(stateRef.current)) as State;
    const result = recipe(next);
    stateRef.current = next;
    setS(next);
    return result;
  };
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
  const loadDemo = () => {
    if (!demo) backup.current = { s: stateRef.current, n: navRef.current };
    setDemo(true);
    demoRef.current = true;
    const next = demoState();
    stateRef.current = next;
    setS(next);
    nav.reset();
    toast("サンプルのデッキを開きました");
  };
  const exitDemo = () => {
    if (!backup.current) return;
    const original = backup.current;
    backup.current = null;
    stateRef.current = original.s;
    navRef.current = original.n;
    setS(original.s);
    setN(original.n);
    setDemo(false);
    demoRef.current = false;
    setOpening(null);
    router.replace(
      original.s.onboarded
        ? routeFor(currentEntry(original.n))
        : routeFor({ id: "onboarding" }),
    );
    toast("自分のデータに戻りました");
  };
  return (
    <Context.Provider
      value={{
        s,
        d: derive(s),
        n,
        nav,
        ready,
        error,
        saveError,
        reload: () => {
          setReady(false);
          setError(null);
          setReloadKey((k) => k + 1);
        },
        retrySave: persist,
        update,
        loadDemo,
        exitDemo,
        demo,
        opening,
        setOpening,
        toast,
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
