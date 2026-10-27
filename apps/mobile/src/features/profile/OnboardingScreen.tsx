import { LegalDocument } from "../auth/LegalDocument";
import { useAuth } from "../auth/provider";
import type { LegalTitle } from "@flocka/domain";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import {
  AvatarPicker,
  CardPicker,
  InterestsPicker,
} from "../../components/pickers";
import {
  Avatar,
  Board,
  Brand,
  Btn,
  C,
  Field,
  Icon,
  LinkButton,
  Panel,
  S,
  StrengthCard,
  T,
  Sheet,
} from "../../components/ui";
import {
  CARDS,
  SNS_PLATFORM_LABELS,
  bareCard,
  snsLinkDisplay,
} from "@flocka/domain";
import { useApp } from "../../store";
import { useBackStep } from "../navigation/use-back-step";
import { SnsLinksEditor } from "./SnsLinksEditor";
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
    "SNS",
    "SNSをリンクしよう。",
    "任意です。交換が成立した相手のカードにだけ表示されます。あとから変更できます。",
  ],
  [
    "しくみ",
    "仲間の証言で、\nカードが本物になる。",
    "今は「自己申告」。2人以上の証言で「確認済み」になり、自己PRの文章が書けます。",
  ],
  ["確認", "このプロフィールで、\nはじめよう。", "あとから変更できます。"],
];
const LAST_STEP = STEPS.length - 1;

export function Onboarding() {
  const { data } = useAuth();
  const { s, update, api, refresh, nav, toast, saveProfile } = useApp(),
    [agree, setAgree] = useState(false),
    [legal, setLegal] = useState<LegalTitle | null>(null),
    [step, setStep] = useState(0),
    [profile, setProfile] = useState(s.profile),
    [sel, setSel] = useState(s.self),
    [snsInvalid, setSnsInvalid] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const previousStep = useCallback(
    () => setStep((current) => Math.max(0, current - 1)),
    [],
  );
  useBackStep(step, previousStep);
  const can =
    step === 0
      ? !!profile.name.trim()
      : step === 3
        ? sel.length >= 2
        : step === 4
          ? !snsInvalid
          : true;
  const finish = async () => {
    if (busy) return;
    if (!data?.user.termsAccepted && !agree) {
      setError("利用規約とプライバシーポリシーへの同意が必要です");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input = {
        ...profile,
        name: profile.name.trim(),
        role: profile.role.trim(),
      };
      if (!data?.user.termsAccepted) await api.acceptTerms();
      await api.createAccount(
        input.avatar.type === "photo"
          ? {
              ...input,
              avatar: { ...input.avatar, type: "initial", photo: undefined },
            }
          : input,
        sel,
      );
      // The account exists from here on. A photo that fails to upload must not
      // undo it: finish with an initial avatar and offer to send the photo again.
      let saved = input;
      let photoFailed = false;
      if (input.avatar.type === "photo" && input.avatar.photo)
        try {
          await api.uploadAvatar(input.avatar.photo);
        } catch {
          photoFailed = true;
          saved = { ...input, avatar: { ...input.avatar, type: "initial" } };
        }
      await api.updateProfile(saved, sel);
      update((x) => {
        x.profile = saved;
        x.self = sel;
        x.onboarded = true;
      });
      // Leave onboarding before syncing, so a failed sync never reopens it;
      // the sync failure itself stays visible as the app's sync banner.
      nav.reset();
      void refresh().catch(() => {});
      if (photoFailed)
        toast(
          "写真を保存できませんでした。プロフィールの編集から再設定できます",
          {
            label: "再送",
            fn: () =>
              void saveProfile(input, sel).then(
                () => toast("写真を保存しました"),
                () => toast("写真を保存できませんでした"),
              ),
          },
        );
      else toast("デッキができた！");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "プロフィールを保存できませんでした",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Board>
      {step === LAST_STEP && !data?.user.termsAccepted && (
        <Panel style={S.gap}>
          <LinkButton
            color={C.ink}
            label="利用規約"
            onPress={() => setLegal("利用規約")}
          />
          <LinkButton
            color={C.ink}
            label="プライバシーポリシー"
            onPress={() => setLegal("プライバシーポリシー")}
          />
          <View style={S.row}>
            <Switch
              accessibilityLabel="利用規約とプライバシーポリシーに同意する"
              value={agree}
              onValueChange={setAgree}
            />
            <T color={C.ink}>内容を確認し、同意する</T>
          </View>
        </Panel>
      )}
      {legal && (
        <Sheet title={legal} onClose={() => setLegal(null)}>
          <LegalDocument title={legal} />
        </Sheet>
      )}
      {error ? (
        <T accessibilityRole="alert" color={C.yellow}>
          {error}
        </T>
      ) : null}
      <View style={[S.row, { minHeight: 48 }]}>
        {step > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="前のステップに戻る"
            onPress={previousStep}
            style={{ padding: 10 }}
          >
            <Icon name="back" />
          </Pressable>
        ) : (
          <Brand />
        )}
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}
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
        <T size={13}>
          {step + 1} / {STEPS.length}
        </T>
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
          <SnsLinksEditor
            links={profile.snsLinks}
            onChange={(snsLinks) => setProfile({ ...profile, snsLinks })}
            onInvalidChange={setSnsInvalid}
            showTitle={false}
          />
        )}
        {step === 5 && (
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
        {step === LAST_STEP && (
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
            <T color={C.muted} size={13}>
              {profile.snsLinks
                .map(
                  (link) =>
                    `${SNS_PLATFORM_LABELS[link.platform]} ${snsLinkDisplay(link)}`,
                )
                .join("　") || "SNS未設定"}
            </T>
            <LinkButton
              label="SNSを変更"
              color={C.ink}
              onPress={() => setStep(4)}
            />
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
          step === LAST_STEP
            ? "この内容ではじめる"
            : step === LAST_STEP - 1
              ? "内容を確認する"
              : "次へ"
        }
        disabled={!can}
        loading={busy}
        onPress={() => (step < LAST_STEP ? setStep(step + 1) : void finish())}
      />
    </Board>
  );
}
