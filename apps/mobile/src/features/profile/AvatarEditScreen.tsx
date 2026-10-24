import { useState } from "react";
import { AvatarPicker } from "../../components/pickers";
import { Board, Btn, Header, InlineError, T } from "../../components/ui";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";
import { useScreenVisit } from "../sync/use-screen-visit";
export function AvatarEdit() {
  const { s, saveProfile, nav, toast } = useApp(),
    [avatar, setAvatar] = useState(s.profile.avatar),
    { busy, error, run } = useAction(),
    startVisit = useScreenVisit();
  return (
    <Board scroll>
      <Header title="アイコン" onBack={nav.pop} />
      <AvatarPicker
        name={s.profile.name}
        avatar={avatar}
        onChange={setAvatar}
        onError={toast}
      />
      <T size={13}>
        写真は160×160に整え、保存時に非公開のストレージへ送信します。
      </T>
      <Btn
        label={busy ? "保存中…" : "保存する"}
        disabled={busy}
        onPress={() =>
          void run(async () => {
            const sameVisit = startVisit();
            await saveProfile({ ...s.profile, avatar }, s.self);
            toast("アイコンを保存しました");
            // A completed save must not pop a later visit or another screen's history.
            if (sameVisit()) nav.pop();
          })
        }
      />
      <InlineError text={error} />
    </Board>
  );
}
