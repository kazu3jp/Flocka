import { useState } from "react";
import { Platform, Pressable, Switch, View } from "react-native";
import { SNS_PLATFORM_LABELS, type LegalTitle } from "@flocka/domain";
import {
  Avatar,
  Board,
  C,
  Envelope,
  F,
  Header,
  Icon,
  InlineError,
  List,
  ListRow,
  OUTLINE,
  Section,
  Sheet,
  T,
} from "../../components/ui";
import { useApp } from "../../store";
import { AccountSection } from "../auth/AccountSection";
import { LegalDocument } from "../auth/LegalDocument";
import { useTour } from "../guided-tour/tour-context";
import { useDeviceNotifications } from "../notifications/use-device-notifications";
import { usePullRefresh } from "../refresh/use-pull-refresh";

/** The source's me-avatar panel: the face and name, opening the icon editor. */
function ProfilePanel() {
  const { s, nav } = useApp();
  return (
    <Pressable
      testID="me-avatar"
      accessibilityRole="button"
      accessibilityLabel={`${s.profile.name}・アイコンを変える`}
      onPress={() => nav.push("avatar")}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderWidth: OUTLINE.width,
        borderColor: C.ink,
        boxShadow: OUTLINE.shadow,
        backgroundColor: pressed ? C.paper2 : C.paper,
      })}
    >
      <Avatar name={s.profile.name} avatar={s.profile.avatar} size={56} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T display color={C.ink} size={20} style={{ lineHeight: 28 }}>
          {s.profile.name}
        </T>
        <T color={C.muted} size={14}>
          アイコンを変える
        </T>
      </View>
      <Icon name="edit" size={20} color={C.ink} />
    </Pressable>
  );
}

/**
 * Testimonies are what the app is for, so they get the deck's yellow banner
 * (the source's .quest) instead of a list row, with the unopened count.
 */
function TestimoniesBanner() {
  const { d, nav } = useApp();
  const total = d.pieces.length,
    unopened = d.unopened.length;
  return (
    <Pressable
      testID="me-pieces"
      accessibilityRole="button"
      accessibilityLabel={`届いた証言 ${total}件${unopened ? `・未開封${unopened}通` : ""}`}
      onPress={() => nav.push("pieces")}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: OUTLINE.width,
        borderColor: C.ink,
        boxShadow: OUTLINE.raisedShadow,
        backgroundColor: C.yellow,
        transform: [{ translateY: pressed ? 2 : 0 }],
      })}
    >
      <View style={{ width: 44, height: 34 }}>
        <Envelope size={40} />
        {unopened > 0 && (
          <View
            style={{
              position: "absolute",
              right: -6,
              top: -6,
              minWidth: 22,
              height: 22,
              paddingHorizontal: 5,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: C.ink,
              backgroundColor: C.pink,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T color={C.ink} size={12} style={{ fontFamily: F.bold }}>
              {unopened}
            </T>
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T display color={C.ink} size={17} style={{ lineHeight: 22 }}>
          届いた証言 {total}件
        </T>
        <T color={C.ink} size={12.5} style={{ lineHeight: 18 }}>
          {unopened
            ? `未開封の封筒が${unopened}通。開けて予想しよう`
            : total
              ? "仲間からの印象と場面のメモ"
              : "交換した仲間から届くと、ここに並びます"}
        </T>
      </View>
      <Icon name="chev" size={20} color={C.ink} />
    </Pressable>
  );
}

/**
 * The source's me screen: the profile panel, the testimonies up front, what
 * makes up the profile, the app's own settings, then the account. Pulling
 * down syncs, so there is no separate sync button.
 */
export function Me() {
  const { s, nav } = useApp(),
    tour = useTour(),
    pull = usePullRefresh(),
    notifications = useDeviceNotifications(),
    [legal, setLegal] = useState<LegalTitle | null>(null);
  const links = s.profile.snsLinks;
  const web = Platform.OS === "web";
  return (
    <Board scroll refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      <Header title="自分" onBack={nav.pop} />
      <ProfilePanel />
      <TestimoniesBanner />
      <Section title="プロフィール">
        <List testID="me-profile">
          <ListRow
            icon="edit"
            title="プロフィールと自己申告カード"
            caption={s.profile.role || "ひとこと未設定"}
            onPress={() => nav.push("selfEdit")}
          />
          <ListRow
            icon="globe"
            title="SNS・Webサイト"
            caption={
              links.length
                ? links
                    .map((link) => SNS_PLATFORM_LABELS[link.platform])
                    .join("・")
                : "未登録・URLを貼るだけで追加"
            }
            onPress={() => nav.push("sns")}
          />
          <ListRow
            icon="shield"
            title="公開範囲・安全"
            caption="受け取る証言・ブロック・通報"
            onPress={() => nav.push("settings")}
          />
        </List>
      </Section>
      <Section title="アプリ">
        <List testID="me-app">
          <ListRow
            icon="spark"
            title="通知"
            caption={
              web
                ? "スマートフォンのアプリで設定できます"
                : "封筒の到着、交換の成立、通報への対応をお知らせします"
            }
            trailing={
              <Switch
                accessibilityLabel="この端末で通知を受け取る"
                value={notifications.registered}
                disabled={web || notifications.disabled}
                onValueChange={notifications.toggle}
                trackColor={{ true: C.blue, false: C.grey }}
              />
            }
          />
          <ListRow
            icon="redo"
            title="使い方をもう一度見る"
            onPress={tour.start}
          />
          <ListRow
            icon="doc"
            title="利用規約"
            onPress={() => setLegal("利用規約")}
          />
          <ListRow
            icon="doc"
            title="プライバシーポリシー"
            onPress={() => setLegal("プライバシーポリシー")}
          />
        </List>
        <InlineError text={notifications.error} />
      </Section>
      <Section title="アカウント">
        <AccountSection />
      </Section>
      {legal && (
        <Sheet title={legal} onClose={() => setLegal(null)}>
          <LegalDocument title={legal} />
        </Sheet>
      )}
    </Board>
  );
}
