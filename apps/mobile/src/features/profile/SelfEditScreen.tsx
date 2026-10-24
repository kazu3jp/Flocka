import { useAction } from "../sync/use-action";
import { useScreenVisit } from "../sync/use-screen-visit";
import { useState } from "react";
import { CardPicker, InterestsPicker } from "../../components/pickers";
import { Board, Btn, C, Field, Header, T } from "../../components/ui";
import { useApp } from "../../store";

export function SelfEdit() {
  const { s, saveProfile, nav, toast } = useApp(),
    [profile, setProfile] = useState(s.profile),
    [sel, setSel] = useState(s.self),
    { busy, error, run } = useAction(),
    startVisit = useScreenVisit();
  return (
    <Board scroll>
      <Header title="プロフィール" onBack={nav.pop} />
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
      {error ? <T color={C.yellow}>{error}</T> : null}
      <CardPicker selected={sel} onChange={setSel} />
      <InterestsPicker
        selected={profile.interests}
        onChange={(interests) => setProfile({ ...profile, interests })}
      />
      <Btn
        label="保存"
        disabled={
          busy || !profile.name.trim() || sel.length < 2 || sel.length > 3
        }
        onPress={() => {
          void run(async () => {
            const sameVisit = startVisit();
            await saveProfile(
              {
                ...profile,
                name: profile.name.trim(),
                role: profile.role.trim(),
              },
              sel,
            );
            toast("プロフィールを保存しました");
            // A completed save must not pop a later visit or another screen's history.
            if (sameVisit()) nav.pop();
          });
        }}
      />
    </Board>
  );
}
