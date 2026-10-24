import React from "react";
import { View } from "react-native";
import type { AvatarData } from "@flocka/domain";
import { Avatar, C, LAYOUT, SP, T } from "../../components/ui";
import { PulseDot } from "./PulseDot";
import { RadarRipple } from "./RadarRipple";
import { isScanning, nearbyCopy, type NearbyStatus } from "./nearby-status";

/** Room for three lines of the longest radio message, so text never moves what follows. */
const HINT_LINES = 3;
const HINT_SIZE = 13;
const LABEL_SIZE = 17;

/**
 * The radar with the user's own avatar in the middle, a status line that says
 * what is happening, and a calm hint or the real reason scanning stopped.
 * Every slot has a fixed height, so a change of state moves nothing below.
 */
export function NearbyRadarPanel({
  status,
  peerCount,
  message,
  name,
  avatar,
}: {
  status: NearbyStatus;
  peerCount: number;
  /** A real failure to show in place of the hint. */
  message: string | null;
  name: string;
  avatar: Partial<AvatarData>;
}) {
  const copy = nearbyCopy(status, peerCount);
  const scanning = isScanning(status);
  const hint = message ?? copy.hint;
  return (
    <View
      style={{
        alignItems: "center",
        paddingTop: SP.md,
        gap: SP.md,
      }}
    >
      <RadarRipple
        active={scanning}
        dim={!scanning && status !== "preparing"}
        light={status === "found"}
      >
        <Avatar name={name} avatar={avatar} size={64} />
      </RadarRipple>
      <View
        testID="nearby-status"
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          message ? `${copy.spoken}。${message}` : copy.spoken
        }
        style={{
          alignSelf: "stretch",
          alignItems: "center",
          gap: SP.xs,
          paddingHorizontal: LAYOUT.screenPadding,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SP.sm,
            minHeight: LABEL_SIZE * 1.5,
          }}
        >
          <PulseDot active={scanning} />
          <T display size={LABEL_SIZE} style={{ textAlign: "center" }}>
            {copy.label}
          </T>
        </View>
        <View style={{ minHeight: HINT_LINES * HINT_SIZE * 1.5 }}>
          <T
            size={HINT_SIZE}
            color={message ? C.yellow : C.pale}
            style={{ textAlign: "center" }}
          >
            {hint}
          </T>
        </View>
      </View>
    </View>
  );
}
