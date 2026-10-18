import { useEffect, useRef } from "react";
import { useAction } from "../sync/use-action";
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
import { CARDS, allPieces, wordsOf } from "@flocka/domain";
import { useApp } from "../../store";

export function PieceDetail({ id }: { id: string }) {
  const { s, nav, api, refresh, toast, d, peers, setOpening, offerUndo } =
      useApp(),
    { busy, error, run } = useAction(),
    { ask, dialog } = useConfirmation();
  const p = allPieces(s).find((p) => p.id === id);
  const redirected = useRef<string | null>(null);
  useEffect(() => {
    if (!p || p.opened || redirected.current === id) return;
    redirected.current = id;
    nav.replace("pieces");
    setOpening(id);
  }, [id, nav, p, setOpening]);
  // A direct URL must follow the same unopened-envelope flow as the inbox.
  if (p && !p.opened) return null;
  if (!p)
    return (
      <Board>
        <Header title="証言" onBack={nav.pop} />
        <T>この証言は見つかりませんでした。</T>
      </Board>
    );
  const changeVisibility = (visibility: "private" | "public" | "hidden") => {
    const apply = () => {
      void run(async () => {
        await api.changeVisibility(id, visibility);
        await refresh();
        toast("公開範囲を変更しました");
      });
    };
    if (visibility === "public")
      ask(
        "個別公開する？",
        "交換した相手が、この証言をプロフィールから閲覧できるようになります。",
        apply,
        "個別公開する",
      );
    else apply();
  };
  return (
    <Board scroll>
      <Header title="証言" onBack={nav.pop} />
      {error && <T color={C.yellow}>{error}</T>}
      <Panel style={S.gap}>
        <T color={C.muted} size={13}>
          {peers[p.fromId]?.profile.name ?? "プロフィールを取得中"}より ·{" "}
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
        {s.connections.find((c) => c.id === p.exchangeId)?.context.place ||
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
      <T display size={18}>
        通報理由
      </T>
      <View style={S.wrap}>
        {["不適切な内容", "嫌がらせ", "個人情報", "その他"].map((reason) => (
          <LinkButton
            key={reason}
            label={reason}
            onPress={() =>
              ask(
                "通報する？",
                `「${reason}」として運営に送信します。`,
                () => {
                  void run(async () => {
                    await api.requestModeration(id, "report", reason);
                    await refresh();
                    toast("通報を受け付けました");
                  });
                },
                "通報する",
              )
            }
          />
        ))}
      </View>
      <Btn
        plain
        label="この人をブロック"
        icon="ban"
        disabled={busy}
        onPress={() =>
          ask(
            "ブロックする？",
            "この人の証言をデッキ・自己PRから外し、交換一覧にも表示しません。",
            () => {
              void run(async () => {
                await api.block(p.fromId);
                await refresh();
                toast("ブロックしました");
                nav.pop();
              });
            },
            "ブロックする",
          )
        }
      />
      <Btn
        plain
        label="削除依頼"
        icon="trash"
        disabled={busy}
        onPress={() =>
          ask(
            "削除を依頼する？",
            "この証言の削除依頼を運営に送信します。",
            () => {
              void run(async () => {
                const request = await api.requestModeration(id, "deletion");
                offerUndo(
                  "削除依頼を受け付けました",
                  () => api.withdrawRequest(request.id),
                  "削除依頼を取り消しました",
                );
                await refresh();
              });
            },
            "依頼する",
          )
        }
      />
      {dialog}
    </Board>
  );
}
