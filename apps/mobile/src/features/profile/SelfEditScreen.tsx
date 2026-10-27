import { useAction } from "../sync/use-action";
import { useScreenVisit } from "../sync/use-screen-visit";
import { useState } from "react";
import { CardPicker, InterestsPicker } from "../../components/pickers";
import {
  Board,
  C,
  F,
  Field,
  Header,
  InlineError,
  LinkButton,
  T,
} from "../../components/ui";
import { useApp } from "../../store";
import { SnsLinksEditor } from "./SnsLinksEditor";
import { useUnsavedChangesGuard } from "../navigation/leave-guard";
import { sameProfileEdit } from "./profile-edit";

export function SelfEdit() {
  const { s, saveProfile, nav, toast } = useApp(),
    [profile, setProfile] = useState(s.profile),
    [sel, setSel] = useState(s.self),
    [snsLinks, setSnsLinks] = useState(s.profile.snsLinks),
    [snsInvalid, setSnsInvalid] = useState(false),
    { busy, error, run } = useAction(),
    startVisit = useScreenVisit(),
    unsaved = !sameProfileEdit(
      { profile: s.profile, self: s.self },
      { profile: { ...profile, snsLinks }, self: sel },
    ),
    guard = useUnsavedChangesGuard({
      unsaved: unsaved && !busy,
      title: "編集内容を破棄する？",
      text: "保存していないプロフィールの変更は失われます。",
      pop: nav.pop,
    });
  const canSave =
    !busy &&
    !snsInvalid &&
    !!profile.name.trim() &&
    sel.length >= 2 &&
    sel.length <= 3;
  const save = () =>
    void run(async () => {
      const sameVisit = startVisit();
      await saveProfile(
        {
          ...profile,
          name: profile.name.trim(),
          role: profile.role.trim(),
          snsLinks,
        },
        sel,
      );
      toast("プロフィールを保存しました");
      // A completed save must not pop a later visit or another screen's history.
      if (sameVisit()) nav.pop();
    });
  // Laid out as the source's s01-edit: 保存 in the header, the cards first.
  return (
    <Board scroll>
      <Header
        title="プロフィール"
        onBack={guard.back}
        right={<LinkButton label="保存" disabled={!canSave} onPress={save} />}
      />
      <InlineError text={error} />
      <T style={{ fontFamily: F.bold, fontSize: 16, lineHeight: 24 }}>
        自己申告カード（2〜3枚）
      </T>
      <CardPicker selected={sel} onChange={setSel} />
      <Field
        label="ニックネーム"
        maxLength={16}
        value={profile.name}
        onChangeText={(name) => setProfile({ ...profile, name })}
      />
      <Field
        label="ひとこと"
        maxLength={24}
        value={profile.role}
        onChangeText={(role) => setProfile({ ...profile, role })}
      />
      <InterestsPicker
        selected={profile.interests}
        onChange={(interests) => setProfile({ ...profile, interests })}
      />
      <SnsLinksEditor
        links={snsLinks}
        onChange={setSnsLinks}
        onInvalidChange={setSnsInvalid}
      />
      <T size={12} color={C.pale}>
        仲間から届いた証言は編集できません。
      </T>
      {guard.dialog}
    </Board>
  );
}
