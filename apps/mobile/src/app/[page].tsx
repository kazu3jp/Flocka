import { ScreenFeedback, ToastBanner } from "../components/feedback";
import { useAuth, SessionStatus } from "../features/auth/provider";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  AvatarEdit,
  Me,
  Onboarding,
  PieceDetail,
  Pieces,
  SelfEdit,
  Settings,
} from "../features/profile";
import { Moderation } from "../features/admin";
import { CardDetail, Deck, Deco, GuessOverlay, PR } from "../features/game";
import { Collection } from "../features/game/CollectionScreen";
import {
  Confirm,
  Connections,
  Exchange,
  Give,
  Memo,
  Nearby,
  Scan,
} from "../features/exchange";
import {
  Board,
  BoardInsets,
  Btn,
  C,
  F,
  Icon,
  S,
  Sheet,
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

const FOCUSED = ["give", "memo", "scan", "confirm", "nearby", "onboarding"];
export default function Screen() {
  const safeInsets = useSafeAreaInsets();
  const auth = useAuth();
  const {
      page: screen,
      key,
      cid,
      id,
    } = useLocalSearchParams<{
      page: string;
      key?: string;
      cid?: string;
      id?: string;
    }>(),
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
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpening(null);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [setOpening]);
  if (auth.isPending || auth.error) return <SessionStatus />;
  if (!auth.data) return <Redirect href="/auth" />;
  if (error)
    return (
      <Board>
        <T>{error}</T>
        <T size={13}>保存データは上書きしていません。</T>
        <Btn label="もう一度読み込む" onPress={reload} />
      </Board>
    );
  // Keep the requested URL while the account snapshot is loading.
  if (!ready)
    return (
      <Board>
        <T color={C.pale}>デッキを読み込み中…</T>
      </Board>
    );
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
  const render = () => {
    switch (screen) {
      case "onboarding":
        return <Onboarding />;
      case "deck":
        return <Deck />;
      case "collection":
        return <Collection />;
      case "card":
        return <CardDetail cardKey={key || ""} />;
      case "deco":
        return <Deco cardKey={key || ""} />;
      case "me":
        return <Me />;
      case "avatar":
        return <AvatarEdit />;
      case "selfEdit":
        return <SelfEdit />;
      case "pieces":
        return <Pieces />;
      case "piece":
        return <PieceDetail key={id} id={id || ""} />;
      case "settings":
        return <Settings />;
      case "moderation":
        return <Moderation />;
      case "exchange":
        return <Exchange />;
      case "connections":
        return <Connections />;
      case "nearby":
        return <Nearby />;
      case "scan":
        return <Scan />;
      case "confirm":
        return <Confirm cid={cid || ""} />;
      case "give":
        return <Give key={cid} cid={cid || ""} />;
      case "memo":
        return <Memo />;
      case "pr":
        return <PR />;
    }
  };
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
        <View key={screen + (key || cid || id || "")} style={S.fill}>
          {render()}
        </View>
      </BoardInsets.Provider>
      {!focused && (
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: C.ink }}>
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 10,
              paddingTop: 4,
              paddingBottom: Math.max(0, 10 - safeInsets.bottom),
            }}
          >
            {tabs.map(([tab, label, icon]) => (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                aria-selected={n.tab === tab}
                accessibilityLabel={label}
                onPress={() => nav.goTab(tab, undefined, n.tab === tab)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  minHeight: 52,
                  borderRadius: 12,
                  backgroundColor: n.tab === tab ? C.yellow : "transparent",
                }}
              >
                <Icon
                  name={icon}
                  color={n.tab === tab ? C.ink : C.tabInactive}
                />
                <T
                  size={12}
                  color={n.tab === tab ? C.ink : C.tabInactive}
                  style={{ fontFamily: F.bold, lineHeight: 19.8 }}
                >
                  {label}
                </T>
                {((tab === "find" && d.unopened.length > 0) ||
                  (tab === "pr" && d.prCard)) && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 4,
                      left: "50%",
                      marginLeft: 8,
                      minWidth: 18,
                      height: 18,
                      paddingHorizontal: 5,
                      borderRadius: 9,
                      backgroundColor: C.pink,
                      borderWidth: 2,
                      borderColor: C.ink,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <T
                      size={10.5}
                      color={C.ink}
                      style={{ fontFamily: F.bold, lineHeight: 14 }}
                    >
                      {tab === "find" ? d.unopened.length : "!"}
                    </T>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      )}
      {saveError && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            preferenceConflict ? setResolvingConflict(true) : retrySave()
          }
          style={{
            position: "absolute",
            top: 30,
            left: 14,
            right: 14,
            backgroundColor: C.danger,
            borderRadius: 10,
            padding: 12,
          }}
        >
          <T size={12}>{saveError} · タップして再試行</T>
        </Pressable>
      )}
      <GuessOverlay />
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
      {syncError && (
        <Pressable
          onPress={() => void refresh().catch(() => {})}
          style={{
            position: "absolute",
            top: 30,
            left: 14,
            right: 14,
            backgroundColor: C.danger,
            padding: 12,
            borderRadius: 10,
          }}
        >
          <T size={12}>{syncError} · タップして再同期</T>
        </Pressable>
      )}
    </ScreenFeedback>
  );
}
