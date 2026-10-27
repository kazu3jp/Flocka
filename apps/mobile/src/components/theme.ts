import { Platform, StyleSheet } from "react-native";

import { COLORS } from "@flocka/domain";

export const C = {
  blue: COLORS.blue,
  dark: COLORS["blue-d"],
  light: COLORS["blue-l"],
  ink: COLORS.ink,
  paper: COLORS.paper,
  paper2: COLORS["paper-2"],
  confirmedPaper: COLORS["confirmed-paper"],
  stage: COLORS.stage,
  tabInactive: COLORS["tab-inactive"],
  stampInk: COLORS["stamp-ink"],
  stampBorder: COLORS["stamp-border"],
  lockedStripe: COLORS["locked-stripe"],
  lockedCenter: COLORS["locked-center"],
  muted: COLORS.muted,
  white: COLORS["on-blue"],
  pale: COLORS["on-blue-muted"],
  yellow: COLORS.yellow,
  pink: COLORS.pink,
  lime: COLORS.lime,
  grey: COLORS.grey,
  danger: COLORS.danger,
};

// Native builds embed the fonts (app.json expo-font plugin). Android names them by
// file name, iOS by the PostScript name inside each file; the web loads them at runtime.
export const F = Platform.select({
  ios: {
    display: "DelaGothicOne-Regular",
    body: "ZenKakuGothicNew-Medium",
    bold: "ZenKakuGothicNew-Bold",
  },
  default: {
    display: "DelaGothicOne_400Regular",
    body: "ZenKakuGothicNew_500Medium",
    bold: "ZenKakuGothicNew_700Bold",
  },
});

/** Spacing scale on a 4pt grid, for padding, margins and gaps. */
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/**
 * Named layout measurements. The original design lays screens out on 14pt
 * page padding and 10/12pt block gaps, and the layout tests compare against
 * those boxes, so these keep the source values instead of rounding to SP.
 */
/**
 * Smallest height of a single-line input. On Android an input that is empty and
 * has no placeholder measures no text line, so its box was `minimum` tall and grew
 * to line + padding + border (56 for a 26.4 line) with the first character.
 * There the minimum is the filled height, so the box never changes while
 * typing. Elsewhere the input is as tall as its line, as in the source design.
 */
export const inputMinHeight = (lineHeight: number) =>
  Platform.OS === "android" ? Math.ceil(lineHeight + 2 * 12 + 2 * 2.5) : 52;

export const LAYOUT = {
  /** Horizontal padding of every screen's content. */
  screenPadding: 14,
  /** Gap between blocks of a fixed (non-scrolling) screen and of forms. */
  blockGap: 10,
  /** Gap between blocks of a scrolling screen and of list rows. */
  sectionGap: 12,
  headerHeight: 48,
  compactHeaderHeight: 44,
  /** Smallest tappable height or width. */
  touchTarget: 44,
  tabItemHeight: 52,
  panelPadding: 16,
  panelPaddingCompact: 14,
  sheetPaddingX: 18,
  sheetPaddingTop: 10,
  sheetPaddingBottom: 22,
  sheetGap: 14,
  /** Distance of floating banners from the screen sides. */
  toastInset: 12,
  /** Width of the app column on a native tablet, centered on the stage. */
  tabletMaxWidth: 560,
} as const;

export const S = StyleSheet.create({
  fill: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: LAYOUT.blockGap,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm },
  gap: { gap: LAYOUT.sectionGap },
  panel: {
    backgroundColor: C.paper,
    borderWidth: 2.5,
    borderColor: C.ink,
    borderRadius: 16,
    padding: LAYOUT.panelPadding,
    boxShadow: `4px 4px 0 ${C.ink}`,
  },
  h1: { fontFamily: F.display, fontSize: 26, lineHeight: 38, color: C.white },
  h2: { fontFamily: F.display, fontSize: 20, lineHeight: 29, color: C.white },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 24, color: C.white },
  cap: { fontFamily: F.bold, fontSize: 12, lineHeight: 18, color: C.pale },
  input: {
    fontFamily: F.body,
    color: C.ink,
    fontSize: 16,
    lineHeight: 25,
    minHeight: inputMinHeight(25),
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.paper,
    borderWidth: 2.5,
    borderColor: C.ink,
    borderRadius: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: LAYOUT.blockGap },
  choice: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.ink,
    padding: LAYOUT.blockGap,
    minHeight: LAYOUT.touchTarget,
    justifyContent: "center",
    backgroundColor: C.paper,
  },
});
