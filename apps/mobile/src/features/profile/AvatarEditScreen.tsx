import { AvatarPicker } from "../../components/pickers";
import { Board, Btn, Header, T } from "../../components/ui";
import { useApp } from "../../store";

export function AvatarEdit() {
  const { s, update, nav, toast } = useApp();
  return (
    <Board scroll>
      <Header title="アイコン" onBack={nav.pop} />
      <AvatarPicker
        name={s.profile.name}
        avatar={s.profile.avatar}
        onChange={(avatar) =>
          update((x) => {
            x.profile.avatar = avatar;
          })
        }
        onError={toast}
      />
      <T size={13}>写真は160×160に整えて、この端末内だけに保存します。</T>
      <Btn label="完了" onPress={nav.pop} />
    </Board>
  );
}
