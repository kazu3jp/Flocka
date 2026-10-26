import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import {
  SNS_INPUT_HINTS,
  SNS_INPUT_MAX_LENGTH,
  SNS_PLATFORMS,
  SNS_PLATFORM_LABELS,
  snsLinkDisplay,
  type SnsLink,
  type SnsPlatform,
} from "@flocka/domain";
import { C, F, InlineError, S, T } from "../../components/ui";
import {
  readSnsInputs,
  snsInputsFromLinks,
  type SnsInputs,
} from "./sns-link-inputs";

/**
 * One field per service, always shown: typing a handle or pasting a profile
 * URL links that service, and clearing the field unlinks it. Any number of
 * services can be filled at once.
 */
export function SnsLinksEditor({
  links,
  onChange,
  onInvalidChange,
  showTitle = true,
}: {
  links: SnsLink[];
  onChange: (links: SnsLink[]) => void;
  /** Tells the caller whether a field holds text that is not a valid link, so it can hold back saving. */
  onInvalidChange?: (invalid: boolean) => void;
  showTitle?: boolean;
}) {
  const [inputs, setInputs] = useState(() => snsInputsFromLinks(links)),
    [focused, setFocused] = useState<SnsPlatform | null>(null);
  const { errors } = readSnsInputs(inputs);
  const linked = new Set(links.map((link) => link.platform));
  // Leaving the editor drops its fields, so nothing stays invalid.
  useEffect(() => () => onInvalidChange?.(false), [onInvalidChange]);
  const change = (platform: SnsPlatform, text: string) => {
    const next: SnsInputs = { ...inputs, [platform]: text };
    const read = readSnsInputs(next);
    setInputs(next);
    onChange(read.links);
    onInvalidChange?.(Object.keys(read.errors).length > 0);
  };
  return (
    <View testID="sns-links-editor" style={S.gap}>
      {showTitle && <T size={13}>SNS · 複数登録できます</T>}
      <View style={{ gap: 8 }}>
        {SNS_PLATFORMS.map((platform) => {
          const label = SNS_PLATFORM_LABELS[platform];
          // Errors wait until the field is left, so typing is not interrupted.
          const error = focused === platform ? undefined : errors[platform];
          return (
            <View key={platform} style={{ gap: 4 }}>
              {/* Framed like the other fields (S.input), with the service as a label cell. */}
              <View
                style={{
                  flexDirection: "row",
                  minHeight: S.input.minHeight,
                  backgroundColor: C.paper,
                  borderWidth: S.input.borderWidth,
                  borderColor: error ? C.danger : C.ink,
                  borderRadius: S.input.borderRadius,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: 96,
                    justifyContent: "center",
                    paddingHorizontal: 10,
                    backgroundColor: linked.has(platform) ? C.yellow : C.paper2,
                    borderRightWidth: 2.5,
                    borderColor: C.ink,
                  }}
                >
                  <T
                    size={13}
                    color={C.ink}
                    numberOfLines={1}
                    style={{ fontFamily: F.bold }}
                  >
                    {label}
                  </T>
                </View>
                <TextInput
                  accessibilityLabel={`${label}のIDまたはURL`}
                  placeholder={SNS_INPUT_HINTS[platform]}
                  placeholderTextColor={C.muted}
                  value={inputs[platform]}
                  maxLength={SNS_INPUT_MAX_LENGTH}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  keyboardType="url"
                  returnKeyType="done"
                  clearButtonMode="while-editing"
                  onFocus={() => setFocused(platform)}
                  onBlur={() => {
                    setFocused(null);
                    // A pasted URL settles to the handle it was read as.
                    const link = links.find(
                      (link) => link.platform === platform,
                    );
                    if (link)
                      setInputs((current) => ({
                        ...current,
                        [platform]: snsLinkDisplay(link),
                      }));
                  }}
                  onChangeText={(text) => change(platform, text)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: F.body,
                    color: C.ink,
                    fontSize: 15,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                />
              </View>
              <InlineError text={error} size={12} />
            </View>
          );
        })}
      </View>
      <T size={12} color={C.pale}>
        入力したSNSが紐づきます。プロフィールURLの貼り付けでもOKです。
        {/* The onboarding step already says who sees the links. */}
        {showTitle ? "交換が成立した相手にだけ表示されます。" : ""}
      </T>
    </View>
  );
}
