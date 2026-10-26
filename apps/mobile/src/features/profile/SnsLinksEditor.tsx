import { useState } from "react";
import { View } from "react-native";
import {
  SNS_INPUT_HINTS,
  SNS_INPUT_MAX_LENGTH,
  SNS_PLATFORMS,
  SNS_PLATFORM_LABELS,
  normalizeSnsHandle,
  snsLinkDisplay,
  type SnsLink,
  type SnsPlatform,
} from "@flocka/domain";
import { Btn, C, Choice, Field, LinkButton, S, T } from "../../components/ui";

/** Links are added one at a time: pick a service, then enter its ID or profile URL. */
export function SnsLinksEditor({
  links,
  onChange,
}: {
  links: SnsLink[];
  onChange: (links: SnsLink[]) => void;
}) {
  const [platform, setPlatform] = useState<SnsPlatform>(SNS_PLATFORMS[0]),
    [text, setText] = useState(""),
    [error, setError] = useState<string | null>(null);
  const add = () => {
    const value = normalizeSnsHandle(platform, text);
    if (value === null) {
      setError(
        `${SNS_PLATFORM_LABELS[platform]}のユーザー名またはURLを確認してください`,
      );
      return;
    }
    // One link per service: adding again replaces the earlier one.
    onChange([
      ...links.filter((link) => link.platform !== platform),
      { platform, value },
    ]);
    setText("");
    setError(null);
  };
  return (
    <View testID="sns-links-editor" style={{ gap: 10 }}>
      <T display size={15} color={C.ink}>
        SNS
      </T>
      {links.length > 0 && (
        <View style={{ gap: 4 }}>
          {links.map((link) => (
            <View key={link.platform} style={[S.row, { gap: 8 }]}>
              <T color={C.ink} style={S.fill}>
                {SNS_PLATFORM_LABELS[link.platform]} {snsLinkDisplay(link)}
              </T>
              <LinkButton
                color={C.ink}
                label={`${SNS_PLATFORM_LABELS[link.platform]}を外す`}
                onPress={() =>
                  onChange(links.filter((other) => other !== link))
                }
              />
            </View>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {SNS_PLATFORMS.map((candidate) => (
          <Choice
            key={candidate}
            label={SNS_PLATFORM_LABELS[candidate]}
            selected={platform === candidate}
            onPress={() => {
              setPlatform(candidate);
              setError(null);
            }}
          >
            <T size={13} color={C.ink}>
              {SNS_PLATFORM_LABELS[candidate]}
            </T>
          </Choice>
        ))}
      </View>
      <Field
        label={`${SNS_PLATFORM_LABELS[platform]}のIDまたはURL`}
        hideLabel
        placeholder={SNS_INPUT_HINTS[platform]}
        value={text}
        maxLength={SNS_INPUT_MAX_LENGTH}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        returnKeyType="done"
        onChangeText={(next) => {
          setText(next);
          setError(null);
        }}
        onSubmitEditing={add}
      />
      {error ? (
        <T accessibilityRole="alert" size={12} color={C.danger}>
          {error}
        </T>
      ) : null}
      <Btn plain small label="追加" disabled={!text.trim()} onPress={add} />
    </View>
  );
}
