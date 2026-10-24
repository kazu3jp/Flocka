import React from "react";
import { View } from "react-native";
import { C } from "./theme";
import { T } from "./text";
import { EnterOnMount } from "./motion";

/**
 * Layout-stability rules for messages:
 * - A message about one field sits in the gap under it (`FieldMessage`), so
 *   showing or hiding it never moves a sibling.
 * - A result of pressing a button goes below that button, never above content
 *   the user is working in (`InlineError`), and fades in instead of popping.
 */

/** Text laid over the gap under the input it belongs to; takes no layout space. */
export function FieldMessage({
  text,
  color = C.yellow,
}: {
  text?: string | null;
  color?: string;
}) {
  if (!text) return null;
  return (
    <EnterOnMount
      from="bottom"
      pointerEvents="none"
      style={{ position: "absolute", left: 2, right: 2, top: "100%" }}
    >
      <T
        accessibilityRole="alert"
        size={12}
        color={color}
        style={{ lineHeight: 18, paddingTop: 2 }}
        numberOfLines={1}
      >
        {text}
      </T>
    </EnterOnMount>
  );
}

/** An action's error, placed under the action it came from. */
export function InlineError({
  text,
  color = C.yellow,
  size = 15,
  reserveLines = 0,
}: {
  text?: string | null;
  color?: string;
  size?: number;
  /** Lines of space kept even when there is no error, where content follows. */
  reserveLines?: number;
}) {
  if (!text && !reserveLines) return null;
  return (
    <View style={{ minHeight: reserveLines * size * 1.5 }}>
      {text ? (
        <EnterOnMount from="bottom">
          <T accessibilityRole="alert" color={color} size={size}>
            {text}
          </T>
        </EnterOnMount>
      ) : null}
    </View>
  );
}
