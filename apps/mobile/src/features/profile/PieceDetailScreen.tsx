import { useScreenFocusEffect } from "../../components/screen-focus";
import { useCallback, useEffect, useRef } from "react";
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
  InlineError,
} from "../../components/ui";
import { CARDS, allPieces, wordsOf, type Piece } from "@flocka/domain";
import { useApp } from "../../store";
import { refreshAfterWrite } from "../sync/refresh-after-write";
import { UserFacingError } from "../sync/user-facing-error";

/** Describes the opening guess without calling a skipped guess a miss. */
function guessResult(p: Piece) {
  if (!p.guess) return "未開封";
  if (p.guess === "skip") return "予想なし";
  const name = CARDS[p.guess]?.name ?? "不明なカード";
  return p.guess === p.card ? `${name}　的中` : `${name}　外れ`;
}

export function PieceDetail({ id }: { id: string }) {
  const { s, nav, api, refresh, toast, d, peers, setOpening, offerUndo } =
      useApp(),
    { busy, error, run } = useAction(),
    { ask, dialog } = useConfirmation();
  const p = allPieces(s).find((p) => p.id === id);
  // Only an open report replaces the reasons; a resolved one can be reported again.
  const reports = s.reports.filter((r) => r.pieceId === id && !r.withdrawn);
  const report = reports.find((r) => !r.status || r.status === "pending");
  const resolved = report
    ? undefined
    : reports.find((r) => r.status === "reviewed" || r.status === "rejected");
  const redirected = useRef<string | null>(null);
  const visit = useRef<object | null>(null);
  useScreenFocusEffect(
    useCallback(() => {
      visit.current = {};
      return () => {
        visit.current = null;
      };
    }, []),
  );
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
        if (p.visibility === visibility) return;
        if (p.visibilityRevision === undefined)
          throw new UserFacingError("最新の証言を読み込み直してください");
        const previous = p.visibility;
        const saved = await api.changeVisibility(
          id,
          visibility,
          p.visibilityRevision,
        );
        offerUndo(
          "公開範囲を変更しました",
          () => api.changeVisibility(id, previous, saved.visibilityRevision),
          "公開範囲を元に戻しました",
        );
        await refreshAfterWrite(refresh, "公開範囲の変更は完了しました");
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
      <Panel style={S.gap}>
        <T color={C.muted} size={13}>
          {peers[p.fromId]?.profile.name ?? "相手"}より ·{" "}
          {p.kind === "proof" ? "見た場面" : "会話の印象"}
        </T>
        <T display color={C.ink} size={20}>
          「{wordsOf(p)}」
        </T>
        {p.label ? (
          <T color={C.muted} size={13}>
            要約：{p.label}
          </T>
        ) : null}
        <T color={C.muted} size={13}>
          {new Date(p.createdAt).toLocaleString("ja-JP")}
        </T>
      </Panel>
      <StrengthCard
        large
        card={d.cards[p.card]}
        style={{ height: 280, width: 210, alignSelf: "center" }}
      />
      <T>予想：{guessResult(p)}</T>
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
          disabled={busy}
          small
          plain={p.visibility !== v}
          icon={p.visibility === v ? "check" : undefined}
          iconSize={16}
          selected={p.visibility === v}
          label={label}
          onPress={() => changeVisibility(v)}
        />
      ))}
      <T display size={18}>
        {report ? "通報済み" : "通報理由"}
      </T>
      {resolved && (
        <T size={13}>
          以前の「{resolved.reason || "通報"}」は運営が確認し、
          {resolved.status === "rejected"
            ? "対応しないと判断しました。"
            : "対応済みです。"}
          ほかに問題があれば、もう一度通報できます。
        </T>
      )}
      {report ? (
        <T size={13}>
          「{report.reason || "通報"}
          」として運営に送信しました。確認をお待ちください。取り下げは「公開範囲・安全」からできます。
        </T>
      ) : (
        <View style={S.wrap}>
          {["不適切な内容", "嫌がらせ", "個人情報", "その他"].map((reason) => (
            <LinkButton
              key={reason}
              label={reason}
              disabled={busy}
              onPress={() =>
                ask(
                  "通報する？",
                  `「${reason}」として運営に送信します。`,
                  () => {
                    void run(async () => {
                      await api.requestModeration(id, "report", reason);
                      await refreshAfterWrite(refresh, "通報は完了しました");
                      toast("通報を受け付けました");
                    });
                  },
                  "通報する",
                )
              }
            />
          ))}
        </View>
      )}
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
                const blockingVisit = visit.current;
                const saved = await api.block(p.fromId);
                if (saved.undoToken) {
                  const token = saved.undoToken;
                  offerUndo(
                    "ブロックしました",
                    () => api.unblock(p.fromId, token),
                    "ブロックを取り消しました",
                  );
                } else toast("すでにブロック中です");
                await refreshAfterWrite(refresh, "ブロックは完了しました");
                if (blockingVisit && visit.current === blockingVisit) nav.pop();
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
                await refreshAfterWrite(refresh, "削除依頼は完了しました");
              });
            },
            "依頼する",
          )
        }
      />
      <InlineError text={error} />
      {dialog}
    </Board>
  );
}
