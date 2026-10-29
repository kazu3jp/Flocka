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
import { useTestimonyActions } from "./use-testimony-actions";
import { VISIBILITY_CHOICES } from "./settings-view-model";

/** Describes the opening guess without calling a skipped guess a miss. */
function guessResult(p: Piece) {
  if (!p.guess) return "未開封";
  if (p.guess === "skip") return "予想なし";
  const name = CARDS[p.guess]?.name ?? "不明なカード";
  return p.guess === p.card ? `${name}　的中` : `${name}　外れ`;
}

export function PieceDetail({ id }: { id: string }) {
  const { s, nav, d, peers, setOpening } = useApp(),
    actions = useTestimonyActions(),
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
      void run(() => actions.changeVisibility(p, visibility));
    };
    if (visibility === "public")
      ask(
        "個別公開する？",
        "交換した相手が、この証言の言葉をあなたのプロフィールから閲覧できるようになります。送った人の名前は表示されません。いつでも戻せます。",
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
          {p.kind === "proof" ? "エピソード" : "第一印象"}
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
      <T size={13}>
        誰に見えるか、どこに使われるかを選べます。いつでも変更できます。
      </T>
      {VISIBILITY_CHOICES.map(([v, label, description]) => (
        <View key={v} style={{ gap: 4 }}>
          <Btn
            disabled={busy}
            small
            plain={p.visibility !== v}
            icon={p.visibility === v ? "check" : undefined}
            iconSize={16}
            selected={p.visibility === v}
            label={label}
            onPress={() => changeVisibility(v)}
          />
          <T size={12} color={C.pale} style={{ paddingHorizontal: 4 }}>
            {description}
          </T>
        </View>
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
                    void run(() => actions.report(id, reason));
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
                await actions.block(p.fromId);
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
              void run(() => actions.requestDeletion(id));
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
