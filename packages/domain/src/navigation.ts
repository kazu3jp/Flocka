export const ROOTS = { find: "deck", exchange: "exchange", pr: "pr" } as const;

export type Tab = keyof typeof ROOTS;

export const SCREENS = [
  "deck",
  "collection",
  "card",
  "deco",
  "me",
  "avatar",
  "selfEdit",
  "pieces",
  "piece",
  "settings",
  "moderation",
  "exchange",
  "connections",
  "nearby",
  "scan",
  "confirm",
  "give",
  "memo",
  "pr",
  "onboarding",
] as const;

export type ScreenId = (typeof SCREENS)[number];

export type Entry = { id: ScreenId; params?: Record<string, string> };

export type NavState = { tab: Tab; stacks: Record<Tab, Entry[]> };

export const initNav = (): NavState => ({
  tab: "find",
  stacks: {
    find: [{ id: "deck" }],
    exchange: [{ id: "exchange" }],
    pr: [{ id: "pr" }],
  },
});

export function validNav(v: unknown): v is NavState {
  if (!v || typeof v !== "object") return false;
  const n = v as NavState;
  return (
    typeof n.tab === "string" &&
    Object.hasOwn(ROOTS, n.tab) &&
    !!n.stacks &&
    typeof n.stacks === "object" &&
    Object.keys(ROOTS).every((k) => {
      const a: unknown = n.stacks[k as Tab];
      return (
        Array.isArray(a) &&
        a.length > 0 &&
        a.length < 50 &&
        a.every(validEntry) &&
        a[0].id === ROOTS[k as Tab]
      );
    })
  );
}

/** The identifier each detail screen cannot render without. */
const REQUIRED_PARAM: Partial<Record<ScreenId, string>> = {
  card: "key",
  deco: "key",
  piece: "id",
  give: "cid",
  confirm: "cid",
};

/** Onboarding is a gate before the tabs, never a page inside a tab's history. */
function stackableEntry(e: Entry) {
  const required = REQUIRED_PARAM[e.id];
  return (
    e.id !== "onboarding" &&
    (!required ||
      (!!e.params &&
        Object.hasOwn(e.params, required) &&
        e.params[required] !== ""))
  );
}

function validEntry(v: unknown): v is Entry {
  if (!v || typeof v !== "object") return false;
  const e = v as Entry;
  return (
    SCREENS.includes(e.id) &&
    (e.params === undefined ||
      (!!e.params &&
        typeof e.params === "object" &&
        !Array.isArray(e.params) &&
        Object.values(e.params).every((value) => typeof value === "string"))) &&
    stackableEntry(e)
  );
}

/** The navigation cache is a convenience; unreadable data restarts at the tab roots. */
export function restoreCachedNav(raw: string | null): NavState {
  if (!raw) return initNav();
  try {
    const cached: unknown = JSON.parse(raw);
    return validNav(cached) ? cached : initNav();
  } catch {
    return initNav();
  }
}

const EXCHANGE_SCREENS = new Set<ScreenId>([
  "exchange",
  "connections",
  "nearby",
  "scan",
  "confirm",
  "give",
  "memo",
]);

function sameEntry(left: Entry, right: Entry) {
  const leftParams = left.params ?? {};
  const rightParams = right.params ?? {};
  return (
    left.id === right.id &&
    Object.keys(leftParams).length === Object.keys(rightParams).length &&
    Object.entries(leftParams).every(
      ([key, value]) => rightParams[key] === value,
    )
  );
}

/** Reconcile an external URL without sending another router navigation. */
export function navigationForRoute(current: NavState, entry: Entry): NavState {
  if (!stackableEntry(entry)) return current;
  const tab: Tab =
    entry.id === "pr"
      ? "pr"
      : EXCHANGE_SCREENS.has(entry.id)
        ? "exchange"
        : "find";
  const root = ROOTS[tab] === entry.id;
  const activeStack = current.stacks[current.tab];
  // Internal navigation already records the originating tab and its back stack.
  if (
    (!root || current.tab === tab) &&
    sameEntry(activeStack[activeStack.length - 1], entry)
  )
    return current;
  const tabs = root
    ? [tab]
    : [...new Set<Tab>([current.tab, tab, "find", "exchange", "pr"])];
  for (const candidate of tabs) {
    const stack = current.stacks[candidate];
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (sameEntry(stack[index], entry))
        return {
          ...current,
          tab: candidate,
          stacks: { ...current.stacks, [candidate]: stack.slice(0, index + 1) },
        };
    }
  }
  return {
    ...current,
    tab,
    stacks: {
      ...current.stacks,
      [tab]: root ? [entry] : [{ id: ROOTS[tab] }, entry],
    },
  };
}
