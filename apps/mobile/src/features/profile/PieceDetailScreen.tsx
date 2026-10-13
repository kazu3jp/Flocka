import { View } from "react-native";
import { useConfirmation } from "../../components/pickers";
import {
  Board,
  Btn,
  C,
  Header,
  LinkButton,
  Panel,
  S,
  StrengthCard,
  T,
} from "../../components/ui";
import { CARDS, PEOPLE, allPieces, now, wordsOf } from "@flocka/domain";
import { useApp } from "../../store";

export function PieceDetail({ id }: { id: string }) {
  const { s, nav, update, toast, d } = useApp(),
    { ask, dialog } = useConfirmation();
  const p = allPieces(s).find((p) => p.id === id);
  if (!p)
    return (
      <Board>
        <Header title="証言" onBack={nav.pop} />
        <T>この証言は見つかりませんでした。</T>
      </Board>
    );
  const changeVisibility = (visibility: "private" | "public" | "hidden") => {
    const old = p.visibility;
    const apply = () => {
      update((x) => {
        const q = [...x.vibes, ...x.proofs].find((p) => p.id === id);
        if (q) q.visibility = visibility;
      });
      toast("公開範囲を変更しました", {
        label: "取り消す",
        fn: () =>
          update((x) => {
            const q = [...x.vibes, ...x.proofs].find((p) => p.id === id);
            if (q) q.visibility = old;
          }),
      });
    };
    if (visibility === "public")
      ask(
        "個別公開する？",
        "この証言を個別公開に設定します。現在は端末内のデモ設定で、他の人へ送信されません。",
        apply,
        "個別公開する",
      );
    else apply();
  };
  return (
    <Board scroll>
      <Header title="証言" onBack={nav.pop} />
      <Panel style={S.gap}>
        <T color={C.muted} size={13}>
          {PEOPLE[p.fromId].name}より ·{" "}
          {p.kind === "proof" ? "見た場面" : "会話の印象"}
        </T>
        <T display color={C.ink} size={20}>
          「{wordsOf(p)}」
        </T>
        {p.label && (
          <T color={C.muted} size={13}>
            要約：{p.label}
          </T>
        )}
        <T color={C.muted} size={13}>
          {new Date(p.createdAt).toLocaleString("ja-JP")}
        </T>
      </Panel>
      <StrengthCard
        large
        card={d.cards[p.card]}
        style={{ height: 280, width: 210, alignSelf: "center" }}
      />
      <T>
        予想：
        {p.guess === "skip" ? "なし" : CARDS[p.guess || ""]?.name || "未開封"}　
        {p.guess === p.card ? "的中" : "予想外"}
      </T>
      <T size={13}>
        場面：
        {s.connections.find((c) => c.peerId === p.fromId)?.context.place ||
          "記録なし"}
      </T>
      <T display size={18}>
        公開範囲
      </T>
      {(
        [
          ["private", "本人だけ"],
          ["public", "個別公開"],
          ["hidden", "非表示"],
        ] as const
      ).map(([v, label]) => (
        <Btn
          key={v}
          small
          plain={p.visibility !== v}
          label={label}
          onPress={() => changeVisibility(v)}
        />
      ))}
      <Btn
        plain
        label="通報"
        icon="flag"
        onPress={() =>
          ask(
            "通報理由",
            "理由を選んで、この端末の記録に残します。運営への送信はまだ接続されていません。",
            () => {},
            "閉じる",
          )
        }
      />
      <View style={S.wrap}>
        {["不適切な内容", "嫌がらせ", "個人情報", "その他"].map((reason) => (
          <LinkButton
            key={reason}
            label={reason}
            onPress={() =>
              ask(
                "通報する？",
                `「${reason}」として端末内に記録します。`,
                () => {
                  update((x) =>
                    x.reports.push({ pieceId: id, reason, at: now() }),
                  );
                  toast("通報を端末内に記録しました");
                },
                "記録する",
              )
            }
          />
        ))}
      </View>
      <Btn
        plain
        label="この人をブロック"
        icon="ban"
        onPress={() =>
          ask(
            "ブロックする？",
            "この人の証言をデッキ・自己PRから外し、交換一覧にも表示しません。",
            () => {
              update((x) => {
                if (!x.blocked.includes(p.fromId)) x.blocked.push(p.fromId);
              });
              toast("ブロックしました", {
                label: "取り消す",
                fn: () =>
                  update((x) => {
                    x.blocked = x.blocked.filter((v) => v !== p.fromId);
                  }),
              });
              nav.pop();
            },
            "ブロックする",
          )
        }
      />
      <Btn
        plain
        label="削除依頼"
        icon="trash"
        onPress={() =>
          ask(
            "削除依頼を記録する？",
            "依頼をこの端末に記録します。運営への送信はまだ接続されていません。",
            () => {
              const at = now();
              update((x) => x.deletions.push({ pieceId: id, at }));
              toast("削除依頼を端末内に記録しました", {
                label: "取り消す",
                fn: () =>
                  update((x) => {
                    const r = x.deletions.find((r) => r.at === at);
                    if (r) r.withdrawn = true;
                  }),
              });
            },
            "依頼を記録する",
          )
        }
      />
      {dialog}
    </Board>
  );
}
