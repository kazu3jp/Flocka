import React, { createContext, useContext } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type FlatListProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";

import { C, LAYOUT, S, SP } from "./theme";
import { T, Icon } from "./text";
import { keyboardAvoidance } from "./keyboard-avoidance";

export function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const scroll = useContext(BoardScroll);
  return (
    <View
      style={[
        S.row,
        { minHeight: LAYOUT.headerHeight, gap: SP.sm },
        scroll && {
          marginTop: -BOARD_TOP_PADDING,
          marginHorizontal: -LAYOUT.screenPadding,
          paddingHorizontal: LAYOUT.screenPadding,
          backgroundColor: C.blue,
        },
      ]}
    >
      {onBack && (
        <Pressable
          accessibilityLabel="戻る"
          accessibilityRole="button"
          onPress={onBack}
          style={{
            width: LAYOUT.touchTarget,
            height: LAYOUT.touchTarget,
            // The arrow is centred in its 44pt target; pull the target out so
            // the arrow sits on the screen padding like the title's block.
            marginLeft: -LAYOUT.blockGap,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="back" />
        </Pressable>
      )}
      <T
        accessibilityRole="header"
        display
        size={20}
        // A long card or person's name keeps the header at most two lines high.
        numberOfLines={2}
        style={{ flex: 1, lineHeight: 26 }}
      >
        {title}
      </T>
      {right}
    </View>
  );
}

/** Pull-to-refresh state is owned by the screen; the board only renders it. */
type BoardRefresh = { refreshing?: boolean; onRefresh?: () => void };

function boardRefreshControl({ refreshing, onRefresh }: BoardRefresh) {
  // react-native-web draws RefreshControl as a plain wrapper that repeats the
  // list's style, which doubles its margins. Pulling does nothing there anyway.
  if (!onRefresh || Platform.OS === "web") return undefined;
  return (
    <RefreshControl
      refreshing={!!refreshing}
      onRefresh={onRefresh}
      tintColor={C.yellow}
      colors={[C.ink]}
      progressBackgroundColor={C.yellow}
    />
  );
}

/**
 * A virtualized list laid out like a scrolling board. Render it as a direct
 * child of a non-scrolling Board so it never nests inside a ScrollView.
 */
export function BoardList<Item>({
  refreshing,
  onRefresh,
  contentContainerStyle,
  ...props
}: Omit<FlatListProps<Item>, "refreshControl" | "refreshing" | "onRefresh"> &
  BoardRefresh) {
  return (
    <FlatList
      {...props}
      keyboardShouldPersistTaps="handled"
      refreshControl={boardRefreshControl({ refreshing, onRefresh })}
      style={[
        { flex: 1, marginHorizontal: -LAYOUT.screenPadding },
        props.style,
      ]}
      contentContainerStyle={[
        {
          paddingHorizontal: LAYOUT.screenPadding,
          paddingTop: 2,
          paddingBottom: LAYOUT.screenPadding,
          gap: LAYOUT.sectionGap,
        },
        contentContainerStyle,
      ]}
    />
  );
}

/** Space between the safe area and the first block of a board. */
const BOARD_TOP_PADDING = SP.xs;
export const BoardInsets = createContext({ top: true, bottom: true });
const BoardScroll = createContext(false);

/**
 * Content style that makes a scrolling Board lay out like a fixed one (same
 * gap and bottom padding). A screen whose main block fills the free height
 * uses it, so it looks as before when everything fits and scrolls on a short
 * screen or with a large font, instead of clipping.
 */
export const FIXED_LOOKING_BOARD: ViewStyle = {
  // A scrolling Board pulls its header up by the top padding; the fixed one does not.
  paddingTop: 2 * BOARD_TOP_PADDING,
  gap: LAYOUT.blockGap,
  paddingBottom: LAYOUT.sectionGap,
};

export function Board({
  children,
  scroll = false,
  form = false,
  footer,
  safeTop,
  safeBottom,
  contentStyle,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  form?: boolean;
  footer?: React.ReactNode;
  safeTop?: boolean;
  safeBottom?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
} & BoardRefresh) {
  const insets = useContext(BoardInsets);
  const firstChild = React.Children.toArray(children)[0];
  const stickyHeader =
    React.isValidElement(firstChild) && firstChild.type === Header;
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: C.blue }}
      edges={[
        "left",
        "right",
        ...((safeTop ?? insets.top) ? ["top" as const] : []),
        ...((safeBottom ?? insets.bottom) ? ["bottom" as const] : []),
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <Pattern
            id="boardGrid"
            width={22}
            height={22}
            patternUnits="userSpaceOnUse"
          >
            <Rect width={22} height={1} fill="#ffffff" fillOpacity={0.05} />
            <Rect width={1} height={22} fill="#ffffff" fillOpacity={0.05} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#boardGrid)" />
      </Svg>
      <BoardScroll.Provider value={scroll && !form}>
        <KeyboardAvoidingView style={S.fill} behavior={keyboardAvoidance}>
          {scroll ? (
            <ScrollView
              stickyHeaderIndices={stickyHeader && !form ? [0] : undefined}
              keyboardShouldPersistTaps="handled"
              refreshControl={boardRefreshControl({ refreshing, onRefresh })}
              contentContainerStyle={[
                {
                  paddingHorizontal: LAYOUT.screenPadding,
                  paddingTop: BOARD_TOP_PADDING,
                  paddingBottom: form ? LAYOUT.sectionGap : SP.xl,
                  gap: form ? LAYOUT.blockGap : LAYOUT.sectionGap,
                  flexGrow: 1,
                },
                contentStyle,
              ]}
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={[
                {
                  flex: 1,
                  paddingHorizontal: LAYOUT.screenPadding,
                  paddingTop: BOARD_TOP_PADDING,
                  paddingBottom: LAYOUT.sectionGap,
                  gap: LAYOUT.blockGap,
                },
                contentStyle,
              ]}
            >
              {children}
            </View>
          )}
          {footer}
        </KeyboardAvoidingView>
      </BoardScroll.Provider>
    </SafeAreaView>
  );
}
