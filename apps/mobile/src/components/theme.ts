import { StyleSheet } from "react-native";

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

export const F = {
  display: "DelaGothicOne_400Regular",
  body: "ZenKakuGothicNew_500Medium",
  bold: "ZenKakuGothicNew_700Bold",
};

export const S = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gap: { gap: 12 },
  panel: {
    backgroundColor: C.paper,
    borderWidth: 2.5,
    borderColor: C.ink,
    borderRadius: 16,
    padding: 16,
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
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.paper,
    borderWidth: 2.5,
    borderColor: C.ink,
    borderRadius: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choice: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.ink,
    padding: 10,
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: C.paper,
  },
});
