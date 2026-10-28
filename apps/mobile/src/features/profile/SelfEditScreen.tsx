import { useAction } from "../sync/use-action";
import { useScreenVisit } from "../sync/use-screen-visit";
import React, { useState } from "react";
import { CardPicker, InterestsPicker } from "../../components/pickers";
import { View } from "react-native";
import { CARDS, type Profile } from "@flocka/domain";
import {
  Avatar,
  C,
  F,
  ForegroundColor,
  OUTLINE,
  Panel,
  S,
  T,
  Board,
  Btn,
  Field,
  Header,
  InlineError,
  LAYOUT,
  Section,
} from "../../components/ui";
import { useApp } from "../../store";
import { useUnsavedChangesGuard } from "../navigation/leave-guard";
import { sameProfileEdit } from "./profile-edit";

/** A paper panel whose text reads in ink, holding one section's fields. */
function EditPanel({ children }: { children: React.ReactNode }) {
  return (
    <Panel style={{ gap: 14 }}>
      <ForegroundColor.Provider value={C.ink}>
        {children}
      </ForegroundColor.Provider>
    </Panel>
  );
}

/**
 * What exchanged peers see, drawn from the edits as they are made, so each
 * change shows its effect before it is saved.
 */
function ProfilePreview({
  profile,
  cards,
  unsaved,
}: {
  profile: Profile;
  cards: string[];
  unsaved: boolean;
}) {
  return (
    <View
      testID="profile-preview"
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 16,
        borderWidth: OUTLINE.width,
        borderColor: C.ink,
        borderStyle: "dashed",
        backgroundColor: C.paper2,
      }}
    >
      <View style={[S.row, { justifyContent: "space-between" }]}>
        <T size={12} color={C.muted} style={{ fontFamily: F.bold }}>
          仲間に見えるあなた
        </T>
        {unsaved ? (
          <T size={12} color={C.stampInk} style={{ fontFamily: F.bold }}>
            未保存の変更あり
          </T>
        ) : null}
      </View>
      <View style={S.row}>
        <Avatar name={profile.name} avatar={profile.avatar} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T display color={C.ink} size={18} style={{ lineHeight: 24 }}>
            {profile.name.trim() || "ニックネーム未入力"}
          </T>
          <T color={C.muted} size={13}>
            {profile.role.trim() || "ひとこと未設定"}
          </T>
        </View>
      </View>
      <T color={C.ink} size={13} style={{ fontFamily: F.bold }}>
        {cards.length
          ? cards.map((key) => CARDS[key]?.name).join("・")
          : "カード未選択"}
      </T>
      {profile.interests.length ? (
        <T color={C.muted} size={12.5}>
          {profile.interests.map((interest) => `#${interest}`).join("　")}
        </T>
      ) : null}
    </View>
  );
}

export function SelfEdit() {
  const { s, saveProfile, nav, toast } = useApp(),
    [profile, setProfile] = useState(s.profile),
    [sel, setSel] = useState(s.self),
    { busy, error, run } = useAction(),
    startVisit = useScreenVisit(),
    unsaved = !sameProfileEdit(
      { profile: s.profile, self: s.self },
      // SNS links are edited on their own screen; this one keeps the saved ones.
      { profile: { ...profile, snsLinks: s.profile.snsLinks }, self: sel },
    ),
    guard = useUnsavedChangesGuard({
      unsaved: unsaved && !busy,
      title: "編集内容を破棄する？",
      text: "保存していないプロフィールの変更は失われます。",
      pop: nav.pop,
    });
  const canSave =
    !busy && !!profile.name.trim() && sel.length >= 2 && sel.length <= 3;
  const save = () =>
    void run(async () => {
      const sameVisit = startVisit();
      await saveProfile(
        {
          ...profile,
          name: profile.name.trim(),
          role: profile.role.trim(),
          snsLinks: s.profile.snsLinks,
        },
        sel,
      );
      toast("プロフィールを保存しました");
      // A completed save must not pop a later visit or another screen's history.
      if (sameVisit()) nav.pop();
    });
  // The source's s01-edit grouped like the rest of the my page: who you are,
  // what you like, then your cards. Saving sits at the bottom, always in
  // reach, and only wakes up once something changed.
  return (
    <Board
      scroll
      footer={
        <View style={{ padding: LAYOUT.screenPadding, paddingTop: 10, gap: 6 }}>
          <InlineError text={error} />
          <Btn
            label="保存する"
            loading={busy}
            disabled={!canSave || !unsaved}
            onPress={save}
          />
        </View>
      }
    >
      <Header title="プロフィール" onBack={guard.back} />
      <ProfilePreview profile={profile} cards={sel} unsaved={unsaved} />
      <Section title="基本情報" lead="仲間に表示されます。">
        <EditPanel>
          <Field
            label={`ニックネーム · ${profile.name.length}/16`}
            maxLength={16}
            value={profile.name}
            onChangeText={(name) => setProfile({ ...profile, name })}
          />
          <Field
            label={`ひとこと · ${profile.role.length}/24`}
            maxLength={24}
            placeholder="今やっていることや、好きなこと"
            value={profile.role}
            onChangeText={(role) => setProfile({ ...profile, role })}
          />
        </EditPanel>
      </Section>
      <Section title="関心" lead="複数選べます。話のきっかけになります。">
        <EditPanel>
          <InterestsPicker
            showLabel={false}
            selected={profile.interests}
            onChange={(interests) => setProfile({ ...profile, interests })}
          />
        </EditPanel>
      </Section>
      <Section
        title="自己申告カード"
        lead="自分の強みだと思うカードを2〜3枚。仲間から届いた証言は編集できません。"
      >
        <EditPanel>
          <CardPicker selected={sel} onChange={setSel} />
        </EditPanel>
      </Section>
      {guard.dialog}
    </Board>
  );
}
