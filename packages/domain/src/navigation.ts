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
