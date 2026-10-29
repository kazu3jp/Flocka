import { useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  Board,
  C,
  Envelope,
  Header,
  Icon,
  LinkButton,
  List,
  ListRow,
  Section,
  T,
} from "../../components/ui";
import {
  CARDS,
  allPieces,
  wordsOf,
  type Piece,
  type State,
} from "@flocka/domain";
import { useApp } from "../../store";
import { usePullRefresh } from "../refresh/use-pull-refresh";

/** Hidden testimonies leave the deck, but stay reachable so they can be shown again. */
function hiddenPieces(s: State) {
  return allPieces(s)
    .filter((p) => p.visibility === "hidden" && !s.blocked.includes(p.fromId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const VISIBILITY: Record<Piece["visibility"], [string, string]> = {
  public: ["globe", "公開中"],
  hidden: ["eyeoff", "外した証言"],
  private: ["lock", "非公開"],
};

/** The source's .vis: who sees this testimony, as an icon and a word. */
function VisibilityMark({ visibility }: { visibility: Piece["visibility"] }) {
  const [icon, label] = VISIBILITY[visibility];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name={icon} size={13} color={C.muted} />
      <T size={12} color={C.muted} style={{ fontWeight: "700" }}>
        {label}
      </T>
    </View>
  );
}

/**
 * The source's s06-pieces as one list per state: envelopes still to open
 * first (opening one starts the guess), then the opened testimonies with who
 * sent them, for which card and who sees them, then the hidden ones.
 */
export function Pieces() {
  const { s, d, nav, setOpening, peers } = useApp();
  const pull = usePullRefresh();
  const [showHidden, setShowHidden] = useState(false);
  const nameOf = (p: Piece) =>
    peers[p.fromId]?.profile.name || "名前を取得できない相手";
  const newest = [...d.pieces].reverse();
  const unopened = newest.filter((p) => !p.opened),
    opened = newest.filter((p) => p.opened),
    hidden = hiddenPieces(s);
  const openedRow = (p: Piece) => (
    <ListRow
      key={p.id}
      leading={
        <Avatar
          name={peers[p.fromId]?.profile.name ?? ""}
          avatar={peers[p.fromId]?.profile.avatar}
          size={32}
        />
      }
      title={p.opened ? wordsOf(p) : "未開封の封筒"}
      caption={`${nameOf(p)}・${p.opened ? (CARDS[p.card]?.name ?? "") : "予想チャレンジ"}`}
      accessibilityLabel={`${nameOf(p)}より・${p.opened ? wordsOf(p) : "未開封"}`}
      trailing={<VisibilityMark visibility={p.visibility} />}
      onPress={() => nav.push("piece", { id: p.id })}
    />
  );
  return (
    <Board scroll refreshing={pull.refreshing} onRefresh={pull.onRefresh}>
      <Header title="届いた証言" onBack={nav.pop} />
      {d.pieces.length === 0 && (
        <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
          まだ届いていません。交換した仲間から印象やメモが届くと、ここに並びます。
        </T>
      )}
      {unopened.length > 0 && (
        <Section
          title={`未開封の封筒（${unopened.length}）`}
          lead="どのカードの証言か予想してから開けます。"
        >
          <List testID="pieces-unopened">
            {unopened.map((p) => (
              <ListRow
                key={p.id}
                leading={<Envelope size={28} />}
                title="未開封の封筒"
                caption={`${nameOf(p)}より`}
                accessibilityLabel={`${nameOf(p)}より・未開封`}
                onPress={() => setOpening(p.id)}
              />
            ))}
          </List>
        </Section>
      )}
      {opened.length > 0 && (
        <Section title={`開封済み（${opened.length}）`}>
          <List testID="pieces-list">{opened.map(openedRow)}</List>
        </Section>
      )}
      {hidden.length > 0 && (
        <View testID="pieces-hidden" style={{ gap: 10 }}>
          <LinkButton
            label={`外した証言（${hidden.length}件）を${showHidden ? "閉じる" : "見る"}`}
            onPress={() => setShowHidden((shown) => !shown)}
          />
          {showHidden && <List>{hidden.map(openedRow)}</List>}
        </View>
      )}
    </Board>
  );
}
