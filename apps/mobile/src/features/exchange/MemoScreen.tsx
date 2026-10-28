import { Board, C, Header, List, ListRow, T } from "../../components/ui";
import { useApp } from "../../store";
import { PeerAvatar } from "./player-card";
import { testimonyKind } from "./testimony-kind";

/**
 * Who to give a testimony to. Each person says whether the next testimony is
 * their first impression or another episode, then opens the one form.
 */
export function Memo() {
  const { s, nav, peers } = useApp();
  const connections = [...s.connections]
    .filter((c) => c.status === "accepted" && !s.blocked.includes(c.peerId))
    .sort((a, b) => (b.exchangedAt ?? "").localeCompare(a.exchangedAt ?? ""));
  return (
    <Board scroll>
      <Header title="証言を贈る" onBack={nav.pop} />
      <T testID="memo-heading" display size={22} style={{ lineHeight: 30 }}>
        誰に贈る？
      </T>
      {connections.length === 0 ? (
        <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
          まだ交換した人がいません。交換すると、ここから証言を贈れます。
        </T>
      ) : (
        <List testID="memo-recipients">
          {connections.map((c) => (
            <ListRow
              key={c.id}
              leading={<PeerAvatar id={c.peerId} size={36} />}
              title={peers[c.peerId]?.profile.name ?? "相手"}
              caption={`${
                testimonyKind(c) === "vibe"
                  ? "第一印象をまだ贈っていません"
                  : "エピソードを贈れます"
              }${c.context.place ? `・${c.context.place}` : ""}`}
              onPress={() => nav.replace("give", { cid: c.id })}
            />
          ))}
        </List>
      )}
    </Board>
  );
}
