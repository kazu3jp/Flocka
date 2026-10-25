import type { ReactNode } from "react";
import { View } from "react-native";
import { C, SP, T } from "../../components/ui";

/**
 * One titled block of the settings screen. The title is a heading for screen
 * readers; the optional lead says in one line what the block is for.
 */
export function SettingsSection({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: SP.md, marginTop: SP.sm }}>
      <View>
        <T accessibilityRole="header" display size={18}>
          {title}
        </T>
        {lead ? (
          <T size={13} color={C.pale}>
            {lead}
          </T>
        ) : null}
      </View>
      {children}
    </View>
  );
}
