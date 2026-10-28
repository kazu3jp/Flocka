import { Board, C, Header, T } from "../../components/ui";
import { useApp } from "../../store";
import { SnsLinksEditor } from "./SnsLinksEditor";

/**
 * SNS and website links, saved as each is added or removed, so there is no
 * separate save step to forget. The rest of the profile is sent unchanged.
 */
export function SnsLinks() {
  const { s, saveProfile, nav } = useApp();
  return (
    <Board scroll>
      <Header title="SNS・Webサイト" onBack={nav.pop} />
      <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
        プロフィールのURLを貼るだけで登録できます。
      </T>
      <SnsLinksEditor
        links={s.profile.snsLinks}
        onChange={(snsLinks) => saveProfile({ ...s.profile, snsLinks }, s.self)}
      />
    </Board>
  );
}
