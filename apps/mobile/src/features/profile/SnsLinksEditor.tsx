import { View } from "react-native";
import {
  SNS_INPUT_HINTS,
  SNS_INPUT_MAX_LENGTH,
  SNS_PLATFORMS,
  SNS_PLATFORM_LABELS,
  type SnsInputs,
  type SnsPlatform,
} from "@flocka/domain";
import { C, Field, T } from "../../components/ui";

/** One text field per platform. Validation is done by the caller with collectSnsLinks. */
export function SnsLinksEditor({
  inputs,
  errors,
  onChange,
}: {
  inputs: SnsInputs;
  errors: Partial<Record<SnsPlatform, string>>;
  onChange: (platform: SnsPlatform, text: string) => void;
}) {
  return (
    <View testID="sns-links-editor" style={{ gap: 10 }}>
      <T display size={15} color={C.ink}>
        SNS
      </T>
      <T size={12} color={C.muted}>
        自己申告です。Flockaは本人のアカウントかどうかを確認しません。交換が成立した相手だけに、プレイヤーカードのリンクとして表示されます。
      </T>
      {SNS_PLATFORMS.map((platform) => (
        <View key={platform} style={{ gap: 4 }}>
          <Field
            label={SNS_PLATFORM_LABELS[platform]}
            placeholder={SNS_INPUT_HINTS[platform]}
            value={inputs[platform] ?? ""}
            maxLength={SNS_INPUT_MAX_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="url"
            onChangeText={(text) => onChange(platform, text)}
          />
          {errors[platform] ? (
            <T accessibilityRole="alert" size={12} color={C.danger}>
              {errors[platform]}
            </T>
          ) : null}
        </View>
      ))}
    </View>
  );
}
