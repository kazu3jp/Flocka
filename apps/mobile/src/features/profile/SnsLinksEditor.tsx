import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import {
  SNS_INPUT_MAX_LENGTH,
  SNS_PLATFORMS,
  SNS_PLATFORM_LABELS,
  snsLinkDisplay,
  type SnsLink,
  type SnsPlatform,
} from "@flocka/domain";
import {
  Btn,
  C,
  Choice,
  F,
  Field,
  Icon,
  InlineError,
  List,
  ListRow,
  Panel,
  S,
  T,
} from "../../components/ui";
import { SnsIcon } from "../../components/sns-icon";
import { pasteText } from "../clipboard/paste-text";
import { SavedButNotRefreshedError } from "../sync/refresh-after-write";
import { userFacingError } from "../sync/user-facing-error";
import { readSnsEntry, withSnsLink, withoutSnsLink } from "./sns-entry";

/**
 * Linked services as rows, and one field to add another: paste a profile URL
 * (or type a handle) and the service is read from it, then 追加する. A handle
 * several services accept asks which one. Adding a service already linked
 * replaces it. `onChange` may save; while it runs the editor waits, and a
 * failure keeps the text and says why.
 */
export function SnsLinksEditor({
  links,
  onChange,
  showNote = true,
  onPendingChange,
}: {
  links: SnsLink[];
  onChange: (links: SnsLink[]) => void | Promise<void>;
  /** The onboarding step already says who sees the links. */
  showNote?: boolean;
  /** Whether the field holds text not added yet, so a step can wait for 追加する. */
  onPendingChange?: (pending: boolean) => void;
}) {
  const [text, setText] = useState(""),
    [chosen, setChosen] = useState<SnsPlatform | null>(null),
    [focused, setFocused] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const entry = readSnsEntry(text, chosen);
  const pending = entry.kind !== "empty";
  useEffect(() => onPendingChange?.(pending), [onPendingChange, pending]);
  // Leaving the editor drops its text, so nothing is left pending.
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const apply = async (next: SnsLink[], after?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onChange(next);
      after?.();
    } catch (failure) {
      // Saved, but reading it back failed: the text is done with.
      if (failure instanceof SavedButNotRefreshedError) after?.();
      setError(userFacingError(failure, "SNSを保存できませんでした"));
    } finally {
      setBusy(false);
    }
  };
  const add = () => {
    if (entry.kind !== "link") return;
    void apply(withSnsLink(links, entry.link), () => {
      setText("");
      setChosen(null);
    });
  };
  const paste = async () => {
    setError(null);
    try {
      setText((await pasteText()).slice(0, SNS_INPUT_MAX_LENGTH));
      setChosen(null);
    } catch (failure) {
      setError(userFacingError(failure, "貼り付けできませんでした"));
    }
  };
  const replacing =
    entry.kind === "link" &&
    links.find((link) => link.platform === entry.link.platform);
  return (
    <View testID="sns-links-editor" style={S.gap}>
      {links.length > 0 ? (
        <List>
          {links.map((link) => (
            <ListRow
              key={link.platform}
              leading={
                <SnsIcon platform={link.platform} size={20} color={C.ink} />
              }
              title={SNS_PLATFORM_LABELS[link.platform]}
              caption={snsLinkDisplay(link)}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${SNS_PLATFORM_LABELS[link.platform]}を削除`}
                  disabled={busy}
                  hitSlop={8}
                  onPress={() =>
                    void apply(withoutSnsLink(links, link.platform))
                  }
                  style={{
                    width: 36,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busy ? 0.4 : 1,
                  }}
                >
                  <Icon name="trash" size={18} color={C.ink} />
                </Pressable>
              }
            />
          ))}
        </List>
      ) : (
        <T size={13} color={C.pale}>
          まだ登録していません。
        </T>
      )}
      <Panel style={{ gap: 12 }}>
        <View style={{ gap: 8 }}>
          <View style={[S.row, { justifyContent: "space-between" }]}>
            <T color={C.ink} size={14} style={{ fontFamily: F.bold }}>
              SNS・Webサイトを追加
            </T>
            <Btn
              plain
              small
              icon="copy"
              iconSize={16}
              label="貼り付け"
              disabled={busy}
              onPress={() => void paste()}
            />
          </View>
          <Field
            label="プロフィールのURLまたはユーザー名"
            hideLabel
            value={text}
            placeholder="URLを貼り付け／ユーザー名"
            maxLength={SNS_INPUT_MAX_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="url"
            returnKeyType="done"
            editable={!busy}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={add}
            onChangeText={(next) => {
              setText(next);
              setError(null);
            }}
          />
          <T size={12} color={C.muted}>
            {SNS_PLATFORMS.map(
              (platform) => SNS_PLATFORM_LABELS[platform],
            ).join("・")}
            に対応
          </T>
        </View>
        {entry.kind === "choose" && (
          <View style={{ gap: 8 }}>
            <T size={13} color={C.ink} style={{ fontFamily: F.bold }}>
              どのサービスのユーザー名ですか？
            </T>
            <View style={[S.row, { flexWrap: "wrap", gap: 8 }]}>
              {entry.candidates.map((platform) => (
                <Choice
                  key={platform}
                  label={SNS_PLATFORM_LABELS[platform]}
                  selected={chosen === platform}
                  onPress={() => setChosen(platform)}
                  style={{ minHeight: 44, paddingHorizontal: 12 }}
                >
                  <View style={[S.row, { gap: 6 }]}>
                    <SnsIcon platform={platform} size={16} color={C.ink} />
                    <T size={13} color={C.ink}>
                      {SNS_PLATFORM_LABELS[platform]}
                    </T>
                  </View>
                </Choice>
              ))}
            </View>
          </View>
        )}
        {entry.kind === "link" && (
          <View
            testID="sns-entry-preview"
            style={[
              S.row,
              {
                gap: 10,
                padding: 10,
                borderRadius: 12,
                backgroundColor: C.paper2,
              },
            ]}
          >
            <SnsIcon platform={entry.link.platform} size={20} color={C.ink} />
            <View style={S.fill}>
              <T size={14} color={C.ink} style={{ fontFamily: F.bold }}>
                {SNS_PLATFORM_LABELS[entry.link.platform]}
              </T>
              <T size={12.5} color={C.muted}>
                {snsLinkDisplay(entry.link)}
                {replacing ? "（登録済みのものと置き換えます）" : ""}
              </T>
            </View>
          </View>
        )}
        {entry.kind === "invalid" && !focused ? (
          <InlineError text={entry.message} size={12} color={C.danger} />
        ) : null}
        <Btn
          label="追加する"
          icon="check"
          iconSize={18}
          loading={busy}
          disabled={busy || entry.kind !== "link"}
          onPress={add}
        />
        <InlineError text={error} size={13} color={C.danger} />
      </Panel>
      {showNote && (
        <T size={12} color={C.pale}>
          交換が成立した相手のカードにだけ表示されます。
        </T>
      )}
    </View>
  );
}
