import React from "react";
import { View } from "react-native";
import { Btn, C, Icon, Panel, SP, T } from "../../components/ui";
import { EnterOnMount } from "../../components/motion";

const TIPS = [
  "Bluetoothがオンになっているか確認する",
  "相手も「近くの人と交換」を開いているか確認する",
  "お互いを近づける",
];

/** Empty-state card: what to check, and the QR exchange that needs no radio. */
export function NearbyTips({ onScan }: { onScan: () => void }) {
  return (
    <EnterOnMount from="bottom">
      <Panel testID="nearby-tips" style={{ gap: SP.sm }}>
        <T display size={15} color={C.ink}>
          まだ誰も見つかりません
        </T>
        {TIPS.map((tip) => (
          <View key={tip} style={{ flexDirection: "row", gap: SP.sm }}>
            <Icon name="check" size={16} color={C.ink} />
            <T size={13} color={C.ink} style={{ flex: 1 }}>
              {tip}
            </T>
          </View>
        ))}
        <Btn plain small icon="qr" label="QRで交換する" onPress={onScan} />
      </Panel>
    </EnterOnMount>
  );
}

/** Web and builds without the module: say so in a card, with the QR way as the alternative. */
export function NearbyUnavailable({
  message,
  onScan,
}: {
  message: string;
  onScan: () => void;
}) {
  return (
    <Panel testID="nearby-unavailable" style={{ gap: SP.sm }}>
      <T color={C.ink} size={14}>
        {message}
      </T>
      <Btn plain small icon="qr" label="QRで交換する" onPress={onScan} />
    </Panel>
  );
}
