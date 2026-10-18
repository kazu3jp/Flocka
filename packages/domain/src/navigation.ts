export const ROOTS = { find: "deck", exchange: "exchange", pr: "pr" } as const;

export type Tab = keyof typeof ROOTS;

export const SCREENS = [
  "deck",
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
    n.tab in ROOTS &&
    Object.keys(ROOTS).every((k) => {
      const a = n.stacks?.[k as Tab];
      return (
        Array.isArray(a) &&
        a.length > 0 &&
        a.length < 50 &&
        a[0].id === ROOTS[k as Tab] &&
        a.every(
          (e) =>
            SCREENS.includes(e.id) &&
            (!e.params ||
              Object.values(e.params).every((v) => typeof v === "string")),
        )
      );
    })
  );
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
