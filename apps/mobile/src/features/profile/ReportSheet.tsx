import { useState } from "react";
import { View } from "react-native";
import { Btn, C, Choice, Sheet, T } from "../../components/ui";

const REPORT_REASONS = ["不適切な内容", "嫌がらせ", "個人情報", "その他"];

/** The source's report sheet: pick one reason, then send it. */
export function ReportSheet({
  onSend,
  onClose,
}: {
  onSend: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  return (
    <Sheet title="通報する" onClose={onClose}>
      <T size={13} color={C.muted}>
        理由を選ぶと、運営に送信します。
      </T>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="理由"
        style={{ gap: 8 }}
      >
        {REPORT_REASONS.map((candidate) => (
          <Choice
            key={candidate}
            accessibilityRole="radio"
            label={candidate}
            selected={reason === candidate}
            onPress={() => setReason(candidate)}
          />
        ))}
      </View>
      <Btn
        danger
        label="通報する"
        disabled={!reason}
        onPress={() => reason && onSend(reason)}
      />
    </Sheet>
  );
}
