import { ScreenFeedback, ToastBanner } from "../components/feedback";
import { EnterOnMount } from "../components/motion";
import { LoadingBoard } from "../components/loading";
import { TabBar } from "../features/navigation/TabBar";
import { useAuth, SessionStatus } from "../features/auth/provider";
import { SignOutAction } from "../features/auth/SignOutAction";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { GuessOverlay } from "../features/game";
import { TutorialSheet } from "../features/tutorial/TutorialSheet";
import { useFirstLaunchTutorial } from "../features/tutorial/use-tutorial-seen";
import { ScreenStacks, screenFor } from "../features/navigation/ScreenStacks";
import {
  Board,
  BoardInsets,
  Btn,
  C,
  LAYOUT,
  S,
  Sheet,
  SP,
  T,
} from "../components/ui";
import { SCREENS, type ScreenId, type Tab } from "@flocka/domain";
import { useApp, useAppStatus } from "../store";

/** Toasts read their own status so showing one does not redraw the screen. */
function AppToast({ focused }: { focused: boolean }) {
  const { notification, dismissToast } = useAppStatus();
  return (
    <ToastBanner
      notification={notification}
      dismiss={dismissToast}
      focused={focused}
    />
  );
}

/** Save and sync failures stay visible until the user retries them. */
function ErrorBanner({
  text,
  hint,
  onPress,
}: {
  text: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    // A live region announces the banner without duplicating the screen's own
    // alert for the same failure.
    <EnterOnMount accessibilityLiveRegion="polite">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityHint={hint}
        onPress={onPress}
        style={{
          minHeight: 44,
          justifyContent: "center",
          backgroundColor: C.danger,
          borderRadius: 10,
          borderWidth: 2.5,
          borderColor: C.ink,
          padding: SP.md,
          boxShadow: `3px 3px 0 ${C.ink}`,
        }}
      >
        <T size={12}>{text}</T>
      </Pressable>
    </EnterOnMount>
  );
}

const FOCUSED = ["give", "memo", "scan", "confirm", "nearby", "onboarding"];
export default function Screen() {
  const safeInsets = useSafeAreaInsets();
  const auth = useAuth();
  const { page: screen } = useLocalSearchParams<{ page: string }>(),
    {
      toast,
      ready,
      error,
      reload,
      s,
      n,
      nav,
      d,
      setOpening,
      syncError,
      refresh,
      preferenceConflict,
      resolvePreferences,
      saveError,
      retrySave,
    } = useApp();
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const tutorial = useFirstLaunchTutorial({
    signedIn: Boolean(auth.data),
    accountReady: ready && !error,
    onboarded: s.onboarded,
    onboardingScreen: screen === "onboarding",
  });
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpening(null);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [setOpening]);
  // A failed background re-check keeps the signed-in screen and its input.
  if (!auth.data)
    return auth.isPending || auth.error ? (
      <SessionStatus />
    ) : (
      <Redirect href="/auth" />
    );
  if (error)
    return (
      <Board>
        <T>{error}</T>
        <T size={13}>保存データは上書きしていません。</T>
        <Btn label="もう一度読み込む" onPress={reload} />
        <SignOutAction />
      </Board>
    );
  // Keep the requested URL while the account snapshot is loading.
  if (!ready) return <LoadingBoard label="デッキを読み込み中…" />;
  if (!SCREENS.includes(screen as ScreenId))
    return (
      <Board>
        <T>この画面はありません。</T>
        <Btn label="デッキへ戻る" onPress={nav.reset} />
      </Board>
    );
  if (!s.onboarded && screen !== "onboarding")
    return (
      <Redirect
        href={{ pathname: "/[page]", params: { page: "onboarding" } }}
      />
    );
  const tabs: [Tab, string, string][] = [
    ["find", "デッキ", "deck"],
    ["exchange", "交換", "swap"],
    ["pr", "自己PR", "doc"],
  ];
  const focused = FOCUSED.includes(screen);
  return (
    <ScreenFeedback
      style={{ flex: 1, backgroundColor: C.blue }}
      feedback={<AppToast focused={focused} />}
    >
      <SafeAreaView edges={["top"]} style={{ backgroundColor: C.blue }} />
      <BoardInsets.Provider value={{ top: false, bottom: focused }}>
        <View style={S.fill}>
          {screen === "onboarding" ? (
            screenFor({ id: "onboarding" })
          ) : (
            <ScreenStacks nav={n} />
          )}
        </View>
      </BoardInsets.Provider>
      {!focused && (
        <TabBar
          items={tabs.map(([tab, label, icon]) => ({
            tab,
            label,
            icon,
            badge:
              tab === "find" && d.unopened.length > 0
                ? String(d.unopened.length)
                : tab === "pr" && d.prCard
                  ? "!"
                  : null,
          }))}
          current={n.tab}
          onSelect={(tab) => nav.goTab(tab, undefined, n.tab === tab)}
        />
      )}
      <GuessOverlay />
      {tutorial.open && <TutorialSheet onClose={tutorial.close} />}
      {resolvingConflict && preferenceConflict && (
        <Sheet
          title="別の端末で更新されています"
          onClose={() => setResolvingConflict(false)}
        >
          <T size={13}>自己PR下書き（この端末）</T>
          <T size={12}>{s.prDraft?.slice(0, 200) || "下書きなし"}</T>
          <T size={13}>自己PR下書き（サーバー）</T>
          <T size={12}>
            {preferenceConflict.data.prDraft?.slice(0, 200) || "下書きなし"}
          </T>
          <T size={12}>装飾と表示カードも、選んだ側の内容を採用します。</T>
          <Btn
            label="サーバーの内容を取り込む"
            onPress={() =>
              void resolvePreferences("server")
                .then(() => setResolvingConflict(false))
                .catch((error) => toast(error.message))
            }
          />
          <Btn
            plain
            label="この端末の編集を保存する"
            onPress={() =>
              void resolvePreferences("local")
                .then(() => setResolvingConflict(false))
                .catch((error) => toast(error.message))
            }
          />
        </Sheet>
      )}
      {saveError || syncError || auth.error ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            // Below the 48pt screen header so its back button stays reachable.
            top: safeInsets.top + LAYOUT.headerHeight + SP.sm,
            left: LAYOUT.screenPadding,
            right: LAYOUT.screenPadding,
            gap: SP.sm,
          }}
        >
          {saveError ? (
            <ErrorBanner
              text={`${saveError} · タップして再試行`}
              hint="保存を再試行します"
              onPress={() =>
                preferenceConflict ? setResolvingConflict(true) : retrySave()
              }
            />
          ) : null}
          {syncError ? (
            <ErrorBanner
              text={`${syncError} · タップして再同期`}
              hint="サーバーと再同期します"
              onPress={() => void refresh().catch(() => {})}
            />
          ) : null}
          {auth.error && (
            <ErrorBanner
              text="ログイン状態を確認できませんでした · タップして再確認"
              hint="ログイン状態をもう一度確認します"
              onPress={() => void auth.refetch()}
            />
          )}
        </View>
      ) : null}
    </ScreenFeedback>
  );
}
