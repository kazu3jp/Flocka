import React, { Children, isValidElement } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { C, F, OUTLINE } from "./theme";
import { Icon, T } from "./text";

/**
 * The source's .list: a paper block with the ink outline and the small
 * shadow, holding rows separated by a thin paper-2 rule.
 */
export function List({ children, style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: C.paper,
          borderWidth: OUTLINE.width,
          borderColor: C.ink,
          borderRadius: 16,
          boxShadow: OUTLINE.shadow,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {Children.toArray(children)
        .filter(isValidElement)
        .map((child, index) => (
          <View
            key={child.key ?? index}
            style={index > 0 && { borderTopWidth: 2, borderTopColor: C.paper2 }}
          >
            {child}
          </View>
        ))}
    </View>
  );
}

/**
 * The source's .list-row: icon, a bold title with an optional muted caption,
 * and what sits on the right. A row with onPress is a button and ends in a
 * chevron unless `trailing` replaces it.
 */
export function ListRow({
  icon,
  leading,
  title,
  caption,
  trailing,
  onPress,
  disabled = false,
  danger = false,
  accessibilityLabel,
  testID,
}: {
  icon?: string;
  /** Replaces the icon, for a service mark or an avatar. */
  leading?: React.ReactNode;
  title: string;
  caption?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  danger?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const color = danger ? C.danger : C.ink;
  const content = (
    <>
      {leading ?? (icon ? <Icon name={icon} size={20} color={color} /> : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T color={color} size={14} style={{ fontFamily: F.bold }}>
          {title}
        </T>
        {caption ? (
          <T color={C.muted} size={12.5} style={{ lineHeight: 19.4 }}>
            {caption}
          </T>
        ) : null}
      </View>
      {trailing !== undefined
        ? trailing
        : onPress && <Icon name="chev" size={18} color={C.ink} />}
    </>
  );
  const rowStyle = {
    minHeight: 56,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  };
  if (!onPress)
    return (
      <View testID={testID} style={rowStyle}>
        {content}
      </View>
    );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={caption}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        rowStyle,
        { backgroundColor: pressed ? C.paper2 : C.paper },
        disabled && { opacity: 0.4 },
      ]}
    >
      {content}
    </Pressable>
  );
}

/**
 * One titled block of a screen: the source's .h3 (bold 16px), an optional
 * one-line lead in the muted on-blue color, then its content. Every screen
 * of the my page groups its parts with this, so they read alike.
 */
export function Section({
  title,
  lead,
  children,
  testID,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <T
          accessibilityRole="header"
          style={{ fontFamily: F.bold, fontSize: 16, lineHeight: 24 }}
        >
          {title}
        </T>
        {lead ? (
          <T size={13} color={C.pale} style={{ lineHeight: 20 }}>
            {lead}
          </T>
        ) : null}
      </View>
      {children}
    </View>
  );
}
