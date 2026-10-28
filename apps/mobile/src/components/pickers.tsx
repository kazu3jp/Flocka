import React, { useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { launchImageLibraryAsync } from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { CachedSvgXml } from "./cached-svg-xml";
import vectors from "../vectors.json";
import {
  AV_COLORS,
  AV_COLOR_NAMES,
  AV_MOTIFS,
  CARDS,
  INTERESTS,
  STRENGTH_GROUPS,
  type AvatarData,
} from "@flocka/domain";
import { Avatar, Btn, C, Choice, F, LinkButton, S, Sheet, SP, T } from "./ui";

export function CardPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [group, setGroup] = useState(0);
  return (
    <View style={S.gap}>
      <T size={13}>{selected.length}/3枚選択 · 2〜3枚選ぼう</T>
      <View
        accessibilityRole="tablist"
        style={[S.row, { gap: SP.xs, alignItems: "stretch" }]}
      >
        {STRENGTH_GROUPS.map(([, label], i) => (
          <View key={label} style={S.fill}>
            <Choice
              accessibilityRole="tab"
              label={label}
              selected={group === i}
              style={S.fill}
              onPress={() => setGroup(i)}
            />
          </View>
        ))}
      </View>
      <View style={S.grid}>
        {STRENGTH_GROUPS[group][2].map((k) => (
          <View key={k} style={{ width: "48%" }}>
            <Choice
              label={CARDS[k].name}
              selected={selected.includes(k)}
              disabled={selected.length >= 3 && !selected.includes(k)}
              onPress={() =>
                onChange(
                  selected.includes(k)
                    ? selected.filter((x) => x !== k)
                    : [...selected, k],
                )
              }
            >
              <View style={S.row}>
                <CachedSvgXml
                  xml={(vectors.cards as Record<string, string>)[k]}
                  width={40}
                  height={40}
                />
                <T size={13} color={C.ink} style={{ flex: 1 }}>
                  {CARDS[k].name}
                </T>
              </View>
            </Choice>
          </View>
        ))}
      </View>
    </View>
  );
}
export function InterestsPicker({
  selected,
  onChange,
  showLabel = true,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  /** Off where a section title already names the choices. */
  showLabel?: boolean;
}) {
  const [more, setMore] = useState(false),
    quick = [
      "Web開発",
      "UI/UX",
      "AI・データ",
      "モバイル",
      "ゲーム",
      "グラフィック",
      "写真",
      "音楽",
      "アニメ",
      "旅行",
      "料理",
      "スポーツ",
    ];
  const choices = (items: string[]) =>
    items.map((i) => (
      <Choice
        key={i}
        label={i}
        selected={selected.includes(i)}
        onPress={() =>
          onChange(
            selected.includes(i)
              ? selected.filter((x) => x !== i)
              : [...selected, i],
          )
        }
      />
    ));
  return (
    <View style={S.gap}>
      {showLabel && <T size={13}>関心 · 複数選べます</T>}
      <View style={S.wrap}>{choices(quick)}</View>
      <LinkButton label="ほかの関心を選ぶ" onPress={() => setMore(true)} />
      {more && (
        <Sheet title="ほかの関心" onClose={() => setMore(false)}>
          <View style={S.wrap}>
            {choices(INTERESTS.filter((i) => !quick.includes(i)))}
          </View>
          <Btn label="決定" onPress={() => setMore(false)} />
        </Sheet>
      )}
    </View>
  );
}
export function AvatarPicker({
  name,
  avatar,
  onChange,
  onError,
}: {
  name: string;
  avatar: AvatarData;
  onChange: (v: AvatarData) => void;
  onError: (s: string) => void;
}) {
  const photo = async () => {
    try {
      const selection = await launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (selection.canceled) return;
      const asset = selection.assets[0],
        side = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      context.crop({
        originX: (asset.width - side) / 2,
        originY: (asset.height - side) / 2,
        width: side,
        height: side,
      });
      context.resize({ width: 160, height: 160 });
      const image = await context.renderAsync(),
        result = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.8,
          base64: true,
        });
      if (!result.base64)
        throw new Error("写真の保存用データを取得できませんでした");
      onChange({
        ...avatar,
        type: "photo",
        photo: `data:image/jpeg;base64,${result.base64}`,
      });
    } catch {
      // Native error messages are not user-facing copy.
      onError(
        "写真を読み込めませんでした。別の写真を選ぶか、もう一度お試しください。",
      );
    }
  };
  const motifRows = Array.from(
    { length: Math.ceil(AV_MOTIFS.length / 3) },
    (_, row) => AV_MOTIFS.slice(row * 3, row * 3 + 3),
  );
  return (
    <View style={S.gap}>
      <View style={{ alignItems: "center" }}>
        <Avatar name={name} avatar={avatar} size={80} />
      </View>
      <View accessibilityRole="radiogroup" style={S.row}>
        {(["initial", "motif", "photo"] as const).map((k, i) => (
          <View style={S.fill} key={k}>
            <Choice
              accessibilityRole="radio"
              label={["頭文字", "イラスト", "写真"][i]}
              selected={avatar.type === k}
              onPress={() =>
                k === "photo" && !avatar.photo
                  ? void photo()
                  : onChange({ ...avatar, type: k })
              }
            />
          </View>
        ))}
      </View>
      {avatar.type === "motif" && (
        // Three equal columns like the decoration options (.deco-grid), with
        // spacers keeping a short last row aligned to the grid.
        <View testID="avatar-motifs" style={{ gap: 8 }}>
          {motifRows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: "row", gap: 8 }}>
              {row.map(([k, l]) => (
                <Choice
                  key={k}
                  label={l}
                  selected={avatar.motif === k}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 82,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    paddingVertical: 8,
                    paddingHorizontal: 4,
                    borderRadius: 14,
                  }}
                  onPress={() => onChange({ ...avatar, motif: k })}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      borderWidth: 2,
                      borderColor: C.ink,
                      backgroundColor: avatar.color,
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <CachedSvgXml
                      xml={(vectors.motifs as Record<string, string>)[k]}
                      width={32}
                      height={32}
                    />
                  </View>
                  <T
                    size={12.5}
                    color={C.ink}
                    numberOfLines={1}
                    style={{ fontFamily: F.bold, lineHeight: 20.625 }}
                  >
                    {l}
                  </T>
                </Choice>
              ))}
              {Array.from({ length: 3 - row.length }, (_, column) => (
                <View key={`empty-${column}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))}
        </View>
      )}
      {avatar.type === "photo" ? (
        <Btn plain label="別の写真を選ぶ" onPress={() => void photo()} />
      ) : (
        <>
          <T size={13}>背景色</T>
          {/* space-between alone spaces the swatches; the row's gap would push the last one off a 320px screen. */}
          <View
            style={[S.row, { justifyContent: "space-between", gap: SP.xs }]}
          >
            {AV_COLORS.map((color, i) => (
              <Pressable
                key={color}
                accessibilityLabel={`${AV_COLOR_NAMES[i]}にする`}
                accessibilityRole="button"
                accessibilityState={{ selected: avatar.color === color }}
                aria-pressed={avatar.color === color}
                onPress={() => onChange({ ...avatar, color })}
                style={{
                  backgroundColor: color,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: avatar.color === color ? 4 : 2,
                  borderColor: avatar.color === color ? C.white : C.ink,
                }}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}
export function useConfirmation() {
  const [pending, setPending] = useState<{
    title: string;
    text: string;
    label: string;
    fn: () => void;
  } | null>(null);
  // A double tap can fire before the closed sheet re-renders; run each confirmation once.
  const handled = useRef(false);
  const ask = (
    title: string,
    text: string,
    fn: () => void,
    label = "確認する",
  ) => {
    handled.current = false;
    setPending({ title, text, label, fn });
  };
  const dialog = pending ? (
    <Sheet title={pending.title} onClose={() => setPending(null)}>
      <T>{pending.text}</T>
      <Btn
        label={pending.label}
        onPress={() => {
          if (handled.current) return;
          handled.current = true;
          pending.fn();
          setPending(null);
        }}
      />
      <Btn plain label="キャンセル" onPress={() => setPending(null)} />
    </Sheet>
  ) : null;
  return { ask, dialog };
}
