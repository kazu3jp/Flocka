import { useState } from "react";
import { AvatarPicker } from "../../components/pickers";
import { Board, Btn, C, Header, T } from "../../components/ui";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";
export function AvatarEdit() {
  const { s, saveProfile, nav, toast } = useApp(),
    [avatar, setAvatar] = useState(s.profile.avatar),
    { busy, error, run } = useAction();
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
      {error && <T color={C.yellow}>{error}</T>}
      <Btn
        label={busy ? "保存中…" : "保存する"}
        disabled={busy}
        onPress={() =>
          void run(async () => {
            await saveProfile({ ...s.profile, avatar }, s.self);
            toast("アイコンを保存しました");
            nav.pop();
          })
        }
      />
    </Board>
  );
}
