import { useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import {
  AvatarPicker,
  CardPicker,
  InterestsPicker,
  useConfirmation,
} from "./components/pickers";
import {
  Avatar,
  Board,
  Brand,
  Btn,
  C,
  Envelope,
  Field,
  Header,
  Icon,
  LinkButton,
  Panel,
  S,
  StrengthCard,
  T,
} from "./components/ui";
import { CARDS, PEOPLE, allPieces, bareCard, now, wordsOf } from "./model";
import { useApp } from "./store";

const STEPS = [
  [
    "ニックネーム",
    "はじめまして。\nニックネームは？",
    "仲間に表示される名前です。あとから変更できます。",
  ],
  [
    "アイコン",
    "あなたの顔になる\nアイコンを選ぼう。",
    "任意です。あとから変更できます。",
  ],
  [
    "ひとこと・関心",
    "あなたらしさを、\nもう少し。",
    "どちらも任意です。話のきっかけになります。",
  ],
  [
    "強みカード",
    "自分の強みだと思う\nカードを2〜3枚。",
    "迷ったら直感で。あとから選び直せます。",
  ],
  [
    "しくみ",
    "仲間の証言で、\nカードが本物になる。",
    "今は「自己申告」。2人以上の証言で「確認済み」になり、自己PRの文章が書けます。",
  ],
  ["確認", "このプロフィールで、\nはじめよう。", "あとから変更できます。"],
];
export function Onboarding() {
  const { s, update, nav, toast } = useApp(),
    [step, setStep] = useState(0),
    [profile, setProfile] = useState(s.profile),
    [sel, setSel] = useState(s.self);
  const can =
    step === 0 ? !!profile.name.trim() : step === 3 ? sel.length >= 2 : true;
  const finish = () => {
    update((x) => {
      x.profile = {
        ...profile,
        name: profile.name.trim(),
        role: profile.role.trim(),
      };
      x.self = sel;
      x.onboarded = true;
    });
    nav.reset();
    toast("デッキができた！");
  };
  return (
    <Board>
      <View style={[S.row, { minHeight: 48 }]}>
        {step > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="前のステップに戻る"
            onPress={() => setStep(step - 1)}
            style={{ padding: 10 }}
          >
            <Icon name="back" />
          </Pressable>
        ) : (
          <Brand />
        )}
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: 6, now: step + 1 }}
          style={[S.row, { flex: 1, gap: 4 }]}
        >
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: i <= step ? C.yellow : C.light,
              }}
            />
          ))}
        </View>
        <T size={13}>{step + 1} / 6</T>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 18, paddingBottom: 18 }}
        style={S.fill}
      >
        <View style={{ gap: 8 }}>
          <T size={12}>
            STEP {String(step + 1).padStart(2, "0")} ／ {STEPS[step][0]}
          </T>
          <T display size={26}>
            {STEPS[step][1]}
          </T>
          <T size={14} color={C.pale}>
            {STEPS[step][2]}
          </T>
        </View>
        {step === 0 && (
          <Field
            label="ニックネーム · 16文字まで"
            value={profile.name}
            placeholder="例：ハル"
            maxLength={16}
            onChangeText={(name) => setProfile({ ...profile, name })}
            onSubmitEditing={() => can && setStep(1)}
            returnKeyType="next"
          />
        )}
        {step === 1 && (
          <AvatarPicker
            name={profile.name}
            avatar={profile.avatar}
            onChange={(avatar) => setProfile({ ...profile, avatar })}
            onError={toast}
          />
        )}
        {step === 2 && (
          <>
            <Field
              label={`ひとこと · ${profile.role.length}/24`}
              maxLength={24}
              value={profile.role}
              onChangeText={(role) => setProfile({ ...profile, role })}
              placeholder="今やっていることや、好きなこと"
            />
            <InterestsPicker
              selected={profile.interests}
              onChange={(interests) => setProfile({ ...profile, interests })}
            />
          </>
        )}
        {step === 3 && <CardPicker selected={sel} onChange={setSel} />}
        {step === 4 && (
          <>
            <T size={13}>あなたのデッキ · 自己申告 {sel.length}枚</T>
            <View style={S.row}>
              {sel.map((k) => (
                <StrengthCard
                  key={k}
                  card={bareCard(k)}
                  style={{ flex: 1, height: 230 }}
                />
              ))}
            </View>
          </>
        )}
        {step === 5 && (
          <Panel style={{ gap: 12 }}>
            <View style={S.row}>
              <Avatar name={profile.name} avatar={profile.avatar} size={56} />
              <T display color={C.ink} style={S.fill}>
                {profile.name.trim()}
              </T>
              <LinkButton
                label="変更"
                color={C.ink}
                onPress={() => setStep(0)}
              />
            </View>
            <T color={C.ink}>{profile.role || "ひとこと未設定"}</T>
            <LinkButton
              label="ひとこと・関心を変更"
              color={C.ink}
              onPress={() => setStep(2)}
            />
            <T color={C.muted} size={13}>
              {profile.interests.map((i) => "#" + i).join("　") || "関心未選択"}
            </T>
            <T color={C.ink}>{sel.map((k) => CARDS[k].name).join("・")}</T>
            <LinkButton
              label="カードを選び直す"
              color={C.ink}
              onPress={() => setStep(3)}
            />
          </Panel>
        )}
      </ScrollView>
      <Btn
        label={
          step === 5
            ? "この内容ではじめる"
            : step === 4
              ? "内容を確認する"
              : "次へ"
        }
        disabled={!can}
        onPress={() => (step < 5 ? setStep(step + 1) : finish())}
      />
    </Board>
  );
}
export function Me() {
  const { s, nav, d } = useApp();
  return (
    <Board scroll>
      <Header title="自分" onBack={nav.pop} />
      <Panel>
        <View style={S.row}>
          <Avatar name={s.profile.name} avatar={s.profile.avatar} size={64} />
          <View style={S.fill}>
            <T display color={C.ink} size={22}>
              {s.profile.name}
            </T>
            <T color={C.muted} size={13}>
              {s.profile.role}
            </T>
          </View>
        </View>
      </Panel>
      {[
        ["avatar", "アイコン", "edit"],
        ["selfEdit", "プロフィールと自己申告カード", "deck"],
        ["pieces", `届いた証言（${d.pieces.length}）`, "list"],
        ["settings", "公開範囲・安全", "shield"],
      ].map(([id, label, icon]) => (
        <Btn
          key={id}
          plain
          label={label}
          icon={icon}
          onPress={() =>
            nav.push(id as "avatar" | "selfEdit" | "pieces" | "settings")
          }
        />
      ))}
    </Board>
  );
}
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
export function SelfEdit() {
  const { s, update, nav, toast } = useApp(),
    [profile, setProfile] = useState(s.profile),
    [sel, setSel] = useState(s.self);
  return (
    <Board scroll>
      <Header title="プロフィール" onBack={nav.pop} />
      <Field
        label="ニックネーム"
        maxLength={16}
        value={profile.name}
        onChangeText={(name) => setProfile({ ...profile, name })}
      />
      <Field
        label="ひとこと"
        maxLength={24}
        value={profile.role}
        onChangeText={(role) => setProfile({ ...profile, role })}
      />
      <CardPicker selected={sel} onChange={setSel} />
      <InterestsPicker
        selected={profile.interests}
        onChange={(interests) => setProfile({ ...profile, interests })}
      />
      <Btn
        label="保存"
        disabled={!profile.name.trim() || sel.length < 2 || sel.length > 3}
        onPress={() => {
          update((x) => {
            x.profile = {
              ...profile,
              name: profile.name.trim(),
              role: profile.role.trim(),
            };
            x.self = sel;
          });
          toast("プロフィールを保存しました");
          nav.pop();
        }}
      />
    </Board>
  );
}
export function Pieces() {
  const { d, nav, setOpening } = useApp();
  return (
    <Board scroll>
      <Header title="届いた証言" onBack={nav.pop} />
      {!d.pieces.length ? (
        <Panel>
          <T color={C.ink}>
            まだ届いていません。交換した仲間から印象やメモが届くと、ここに並びます。
          </T>
        </Panel>
      ) : (
        [...d.pieces].reverse().map((p) => (
          <Pressable
            accessibilityRole="button"
            key={p.id}
            onPress={() =>
              p.opened ? nav.push("piece", { id: p.id }) : setOpening(p.id)
            }
          >
            <Panel style={S.row}>
              {p.opened ? <Icon name="doc" color={C.ink} /> : <Envelope />}
              <View style={S.fill}>
                <T color={C.ink}>
                  {PEOPLE[p.fromId].name}より ·{" "}
                  {p.opened ? "開封済み" : "未開封"}
                </T>
                <T color={C.muted} size={13}>
                  {p.opened ? wordsOf(p) : "どのカードの証言か予想しよう"}
                </T>
              </View>
              <Icon name="chev" color={C.ink} />
            </Panel>
          </Pressable>
        ))
      )}
    </Board>
  );
}
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
export function Settings() {
  const { s, update, nav, toast } = useApp(),
    [settings, setSettings] = useState(s.settings),
    { ask, dialog } = useConfirmation();
  return (
    <Board scroll>
      <Header title="公開範囲・安全" onBack={nav.pop} />
      <Panel style={S.gap}>
        {(
          [
            ["allowVibe", "印象を受け取る"],
            ["allowProof", "場面のメモを受け取る"],
            ["onlyConnected", "交換した人からだけ"],
          ] as const
        ).map(([k, label]) => (
          <View style={S.row} key={k}>
            <T color={C.ink} style={S.fill}>
              {label}
            </T>
            <Switch
              accessibilityLabel={label}
              value={settings[k]}
              onValueChange={(v) => setSettings({ ...settings, [k]: v })}
              trackColor={{ true: C.blue, false: C.grey }}
            />
          </View>
        ))}
      </Panel>
      <Btn
        label="設定を保存"
        onPress={() =>
          ask(
            "受け取り設定を変更する？",
            "変更は今後届く封筒に適用します。",
            () => {
              update((x) => {
                x.settings = settings;
              });
              toast("設定を保存しました");
            },
            "保存する",
          )
        }
      />
      <T display size={18}>
        ブロック中
      </T>
      {s.blocked.length ? (
        s.blocked.map((id) => (
          <Btn
            key={id}
            plain
            label={`${PEOPLE[id]?.name || id}のブロックを解除`}
            onPress={() => {
              update((x) => {
                x.blocked = x.blocked.filter((v) => v !== id);
              });
              toast("ブロックを解除しました");
            }}
          />
        ))
      ) : (
        <T size={13}>ブロックしている人はいません。</T>
      )}
      <T display size={18}>
        通報・削除依頼の履歴
      </T>
      {(["reports", "deletions"] as const).map((k) =>
        s[k].map((r, i) => (
          <Panel key={k + r.at}>
            <T color={C.ink} size={13}>
              {k === "reports" ? "通報" : "削除依頼"} · {r.reason || "削除依頼"}{" "}
              · {r.withdrawn ? "取り下げ済み" : "端末内記録"}
            </T>
            {!r.withdrawn && (
              <LinkButton
                color={C.ink}
                label="取り下げる"
                onPress={() => {
                  update((x) => {
                    x[k][i].withdrawn = true;
                  });
                  toast("取り下げました");
                }}
              />
            )}
          </Panel>
        )),
      )}
      <T size={13} color={C.pale}>
        この移植版はデザインの操作用デモです。近距離通信・相手への送信・公開・運営への送信には接続していません。プロフィールと写真は端末内に保存されます。
      </T>
      {dialog}
    </Board>
  );
}
