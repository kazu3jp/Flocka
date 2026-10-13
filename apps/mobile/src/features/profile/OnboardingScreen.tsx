import { getApiClient } from "../auth/client";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
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
} from "../../components/ui";
import { CARDS, bareCard } from "@flocka/domain";
import { useApp } from "../../store";
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
    [sel, setSel] = useState(s.self),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const can =
    step === 0 ? !!profile.name.trim() : step === 3 ? sel.length >= 2 : true;
  const finish = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const input = {
        ...profile,
        name: profile.name.trim(),
        role: profile.role.trim(),
      };
      await getApiClient().createAccount(input, sel);
      update((x) => {
        x.profile = input;
        x.self = sel;
        x.onboarded = true;
      });
      nav.reset();
      toast("デッキができた！");
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
      {error && <T color={C.yellow}>{error}</T>}
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
        disabled={!can || busy}
        onPress={() => (step < 5 ? setStep(step + 1) : void finish())}
      />
    </Board>
  );
}
