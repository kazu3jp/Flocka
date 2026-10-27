import { LegalDocument } from "./LegalDocument";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Redirect, useLocalSearchParams, type Href } from "expo-router";
import {
  Board,
  Brand,
  Btn,
  C,
  F,
  Icon,
  InlineError,
  LAYOUT,
  LinkButton,
  S,
  Sheet,
  SP,
  T,
  OUTLINE,
} from "../../components/ui";
import { assertAuthResult, getAuthClient } from "./client";
import { fetchAuthProviders } from "./auth-config";
import { browserFlowErrorMessage } from "./auth-error-message";
import { signInWithGoogle } from "./google-sign-in";
import { userFacingError } from "../sync/user-facing-error";
import { SessionStatus, useAuth } from "./provider";
import { WelcomeTour } from "./WelcomeTour";
import { markFreshSignIn } from "./fresh-sign-in";
import { useBackStep } from "../navigation/use-back-step";
import {
  PasswordField,
  AuthField,
  AuthHeader,
  SocialButtons,
  validEmail,
  validPassword,
} from "./fields";
import { useDeferredValidation } from "./use-deferred-validation";

type AuthView = "welcome" | "signup" | "verify" | "login" | "reset";
export function AuthScreen({
  destination = "/",
  returnURL,
  initialView = "welcome",
}: {
  destination?: Href;
  returnURL?: string;
  initialView?: "welcome" | "login";
} = {}) {
  const session = useAuth(),
    { error: redirectError } = useLocalSearchParams<{ error?: string }>(),
    [view, setView] = useState<AuthView>(initialView),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [agree, setAgree] = useState(false),
    [otp, setOtp] = useState(""),
    [wait, setWait] = useState(0),
    [busy, setBusy] = useState(false),
    // The web Google flow returns here as /auth?error=<code> when it fails.
    [error, setError] = useState<string | null>(() =>
      Platform.OS === "web" &&
      redirectError &&
      /^[a-z0-9_]{1,64}$/i.test(redirectError)
        ? browserFlowErrorMessage(redirectError)
        : null,
    ),
    [notice, setNotice] = useState<string | null>(null),
    [deliverySent, setDeliverySent] = useState(false),
    [legal, setLegal] = useState<"利用規約" | "プライバシーポリシー" | null>(
      null,
    ),
    [providers, setProviders] = useState<string[]>([]);
  const mounted = useRef(true),
    running = useRef(false);
  // Whoever signs in from this screen starts on the home screen.
  useEffect(() => markFreshSignIn(), []);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void fetchAuthProviders(controller.signal)
      .then((providers) => {
        if (mounted.current) setProviders(providers);
      })
      .catch((error) => {
        if (mounted.current && error.name !== "AbortError")
          setError(
            "認証APIに接続できません。接続先とサーバーの起動を確認してください。",
          );
      });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  const emailCheck = useDeferredValidation(email, validEmail);
  const resetEmailCheck = emailCheck.reset;
  const go = useCallback(
    (next: AuthView) => {
      setView(next);
      resetEmailCheck();
      setError(null);
      setNotice(null);
      setPassword("");
    },
    [resetEmailCheck],
  );
  const back = useCallback(() => {
    if (!busy)
      go(view === "verify" ? "signup" : view === "reset" ? "login" : "welcome");
  }, [busy, go, view]);
  // Android back steps through the auth views before it leaves the app.
  useBackStep(view === "welcome" ? 0 : 1, back);
  const run = async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      if (mounted.current)
        setError(userFacingError(error, "通信に失敗しました"));
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const sendCode = async () => {
    assertAuthResult(
      await getAuthClient().emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: "email-verification",
      }),
    );
    if (mounted.current) {
      setDeliverySent(true);
      setOtp("");
      setWait(30);
      setView("verify");
      setPassword("");
    }
  };
  const signup = () =>
    run(async () => {
      assertAuthResult(
        await getAuthClient().signUp.email({
          email: email.trim(),
          password,
          name: "Flockaプレイヤー",
          termsAccepted: agree,
        }),
      );
      if (mounted.current) {
        setDeliverySent(false);
        setView("verify");
        setPassword("");
      } // Keep resend available if provider delivery fails.
      await sendCode();
    });
  const login = () =>
    run(async () => {
      const result = await getAuthClient().signIn.email({
        email: email.trim(),
        password,
      });
      if (result.error?.code === "EMAIL_NOT_VERIFIED") {
        await sendCode();
        return;
      }
      assertAuthResult(result);
      setPassword("");
      await session.refetch();
    });
  const verify = () =>
    run(async () => {
      assertAuthResult(
        await getAuthClient().emailOtp.verifyEmail({
          email: email.trim(),
          otp,
        }),
      );
      setOtp("");
      await session.refetch();
    });
  const reset = () =>
    run(async () => {
      assertAuthResult(
        await getAuthClient().requestPasswordReset({
          email: email.trim(),
          redirectTo:
            Platform.OS === "web"
              ? new URL("/reset-password", window.location.origin).href
              : "flocka://reset-password",
        }),
      );
      if (mounted.current)
        setNotice(
          "登録済みのメールアドレスの場合、再設定用のリンクを送ります。受信箱を確認してください。",
        );
    });
  const social = () =>
    run(async () => {
      if (
        (await signInWithGoogle(returnURL)) === "done" &&
        Platform.OS !== "web"
      )
        await session.refetch();
    });
  if (session.data) return <Redirect href={destination} />;
  if (session.isPending || session.error) return <SessionStatus />;
  const emailOk = validEmail(email);
  const mailField = (
    <AuthField
      label="メールアドレス"
      value={email}
      onChangeText={setEmail}
      onBlur={emailCheck.onBlur}
      error={
        emailCheck.invalid ? "メールアドレスの形式を確認してください" : null
      }
      keyboardType="email-address"
      autoComplete="email"
      autoCapitalize="none"
      autoCorrect={false}
      placeholder="例：haru@example.com"
      editable={!busy}
    />
  );
  const titles = {
    welcome: "",
    signup: "アカウントを作成",
    verify: "メールアドレスの確認",
    login: "ログイン",
    reset: "パスワードの再設定",
  };
  const button =
    view === "welcome"
      ? (["アカウントを作成", () => go("signup"), false] as const)
      : view === "signup"
        ? ([
            "メールで登録",
            signup,
            !(emailOk && validPassword(password) && agree),
          ] as const)
        : view === "verify"
          ? (["確認して次へ", verify, otp.length !== 6] as const)
          : view === "reset"
            ? (["リンクを送る", reset, !emailOk] as const)
            : (["ログイン", login, !(emailOk && password)] as const);
  return (
    <Board
      scroll
      contentStyle={{ paddingTop: 4, paddingBottom: 0, gap: 0 }}
      footer={
        <View
          style={{
            paddingHorizontal: LAYOUT.screenPadding,
            paddingTop: SP.md,
            paddingBottom: LAYOUT.screenPadding,
            gap: 6,
            marginHorizontal: view === "welcome" ? 0 : LAYOUT.screenPadding,
            ...(view !== "welcome" && {
              paddingHorizontal: 0,
              borderTopWidth: 2,
              borderTopColor: C.dark,
            }),
          }}
        >
          <Btn
            label={busy ? "処理中…" : button[0]}
            disabled={busy || button[2]}
            onPress={() => void button[1]()}
          />
          {view === "welcome" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="アカウントをお持ちの方はログイン"
              onPress={() => go("login")}
              style={{
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T size={14} style={{ fontFamily: F.bold }}>
                アカウントをお持ちの方は{" "}
                <T
                  size={14}
                  style={{
                    fontFamily: F.bold,
                    textDecorationLine: "underline",
                  }}
                >
                  ログイン
                </T>
              </T>
            </Pressable>
          )}
        </View>
      }
    >
      {view === "welcome" ? (
        <>
          <View style={[S.row, { minHeight: 56 }]}>
            <Brand size={40} />
            <T display size={22}>
              Flocka
            </T>
            <T
              size={12}
              color={C.pale}
              style={{ marginLeft: "auto", fontFamily: F.bold, flexShrink: 1 }}
            >
              仲間の言葉で、強みが見つかる
            </T>
          </View>
          <WelcomeTour />
        </>
      ) : (
        <>
          <AuthHeader title={titles[view]} onBack={back} />
          <View style={{ flex: 1, paddingTop: 10, paddingBottom: 16, gap: 20 }}>
            {(view === "signup" || view === "login") && (
              <SocialButtons
                available={providers}
                busy={busy}
                onPress={() => void social()}
              />
            )}
            {view === "verify" ? (
              <>
                <View style={{ gap: 8 }}>
                  <T display size={26} style={{ lineHeight: 36.4 }}>
                    確認コードを{"\n"}入力してください。
                  </T>
                  <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
                    {email.trim()}{" "}
                    {deliverySent
                      ? "に6桁のコードを送りました。届かない場合は再送してください。"
                      : "宛ての確認コードを送信してください。"}
                  </T>
                </View>
                <AuthField
                  label="確認コード（6桁）"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChangeText={(value) => setOtp(value.replace(/\D/g, ""))}
                  placeholder="000000"
                  editable={!busy}
                  style={{
                    fontFamily: F.display,
                    fontSize: 28,
                    lineHeight: 28,
                    letterSpacing: 11.2,
                    textAlign: "center",
                  }}
                />
                <View
                  style={[
                    S.row,
                    { justifyContent: "space-between", flexWrap: "wrap" },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      wait ? `コードを再送（あと${wait}秒）` : "コードを再送"
                    }
                    accessibilityState={{ disabled: wait > 0 || busy }}
                    disabled={wait > 0 || busy}
                    onPress={() => void run(sendCode)}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <T size={13} color={C.pale}>
                      {wait ? `再送まで${wait}秒` : "コードを再送"}
                    </T>
                  </Pressable>
                  <LinkButton
                    label="メールアドレスを変更"
                    disabled={busy}
                    onPress={() => go("signup")}
                  />
                </View>
              </>
            ) : (
              <>
                {view === "reset" && (
                  <View style={{ gap: 8 }}>
                    <T display size={26} style={{ lineHeight: 36.4 }}>
                      再設定用のリンクを{"\n"}メールで送ります。
                    </T>
                    <T size={14} color={C.pale} style={{ lineHeight: 22.4 }}>
                      登録したメールアドレスを入力してください。
                    </T>
                  </View>
                )}
                {mailField}
                {(view === "signup" || view === "login") && (
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    signup={view === "signup"}
                  />
                )}
                {view === "login" && (
                  <View style={{ alignSelf: "flex-start", marginLeft: -8 }}>
                    <LinkButton
                      label="パスワードを忘れた方"
                      onPress={() => {
                        if (!busy) go("reset");
                      }}
                    />
                  </View>
                )}
                {view === "signup" && (
                  <View style={[S.row, { minHeight: 44, gap: 12 }]}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel="利用規約とプライバシーポリシーに同意する"
                      aria-checked={agree}
                      onPress={() => setAgree(!agree)}
                      style={{
                        width: 44,
                        height: 44,
                        margin: -9,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderWidth: OUTLINE.width,
                          borderColor: C.ink,
                          borderRadius: 7,
                          backgroundColor: agree ? C.yellow : C.paper,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {agree && <Icon name="check" size={16} color={C.ink} />}
                      </View>
                    </Pressable>
                    <T
                      size={14}
                      style={{ flex: 1, fontFamily: F.bold, lineHeight: 23.1 }}
                      onPress={() => setAgree(!agree)}
                    >
                      <T
                        size={14}
                        accessibilityRole="link"
                        style={{
                          fontFamily: F.bold,
                          textDecorationLine: "underline",
                        }}
                        onPress={(event) => {
                          event.stopPropagation();
                          setLegal("利用規約");
                        }}
                      >
                        利用規約
                      </T>
                      と
                      <T
                        size={14}
                        accessibilityRole="link"
                        style={{
                          fontFamily: F.bold,
                          textDecorationLine: "underline",
                        }}
                        onPress={(event) => {
                          event.stopPropagation();
                          setLegal("プライバシーポリシー");
                        }}
                      >
                        プライバシーポリシー
                      </T>
                      に同意する
                    </T>
                  </View>
                )}
              </>
            )}
          </View>
        </>
      )}
      <InlineError text={error} size={13} />
      {notice ? (
        <T accessibilityLiveRegion="polite" color={C.pale} size={13}>
          {notice}
        </T>
      ) : null}
      {legal && (
        <Sheet title={legal} onClose={() => setLegal(null)}>
          <LegalDocument title={legal} />
          <Btn plain label="閉じる" onPress={() => setLegal(null)} />
        </Sheet>
      )}
    </Board>
  );
}
