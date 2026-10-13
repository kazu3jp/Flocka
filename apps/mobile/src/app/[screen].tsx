import { useAuth, SessionStatus } from "../features/auth/provider";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
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
  Icon,
  S,
  Sheet,
  T,
} from "../components/ui";
import { SCREENS, type ScreenId, type Tab } from "@flocka/domain";
import { useApp } from "../store";

const FOCUSED = ["give", "memo", "scan", "confirm", "nearby", "onboarding"];
export default function Screen() {
  const auth = useAuth();
  const { screen, key, cid, id } = useLocalSearchParams<{
      screen: string;
      key?: string;
      cid?: string;
      id?: string;
    }>(),
    {
      toast,
      ready,
      error,
      s,
      n,
      nav,
      d,
      setOpening,
      syncError,
      syncing,
      refresh,
      preferenceConflict,
      resolvePreferences,
      notification,
      dismissToast,
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
  if (!ready || error) return <Redirect href="/" />;
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
        href={{ pathname: "/[screen]", params: { screen: "onboarding" } }}
      />
    );
  const render = () => {
    switch (screen) {
      case "onboarding":
        return <Onboarding />;
      case "deck":
        return <Deck />;
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
        return <PieceDetail id={id || ""} />;
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
        return <Give cid={cid || ""} />;
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
    <View style={{ flex: 1, backgroundColor: C.blue }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: C.blue }}>
        <View
          style={{
            height: 24,
            flexDirection: "row",
            justifyContent: "flex-end",
            paddingHorizontal: 20,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="サーバーと同期"
            onPress={() => void refresh().catch(() => {})}
            style={{
              paddingHorizontal: 10,
              borderRadius: 99,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: C.pale,
              justifyContent: "center",
            }}
          >
            <T size={10} color={C.pale}>
              {syncing ? "同期中…" : "同期"}
            </T>
          </Pressable>
        </View>
      </SafeAreaView>
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
              minHeight: 64,
              paddingHorizontal: 12,
              gap: 8,
            }}
          >
            {tabs.map(([tab, label, icon]) => (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: n.tab === tab }}
                accessibilityLabel={label}
                onPress={() => nav.goTab(tab, undefined, n.tab === tab)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  borderRadius: 12,
                  marginVertical: 7,
                  backgroundColor: n.tab === tab ? C.yellow : "transparent",
                }}
              >
                <Icon name={icon} color={n.tab === tab ? C.ink : C.pale} />
                <T size={11} color={n.tab === tab ? C.ink : C.pale}>
                  {label}
                  {tab === "find" && d.unopened.length
                    ? ` ${d.unopened.length}`
                    : tab === "pr" && d.prCard
                      ? " !"
                      : ""}
                </T>
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
      {notification && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={notification.text}
          onPress={dismissToast}
          style={{
            position: "absolute",
            bottom: focused ? 90 : 82,
            left: 14,
            right: 14,
            backgroundColor: C.paper,
            borderWidth: 2.5,
            borderColor: C.ink,
            borderRadius: 14,
            padding: 12,
            boxShadow: `4px 4px 0 ${C.ink}`,
          }}
        >
          <View style={S.row}>
            <T color={C.ink} size={13} style={S.fill}>
              {notification.text}
            </T>
            {notification.action && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={notification.action.label}
                onPress={() => {
                  notification.action?.fn();
                  dismissToast();
                }}
                style={{ padding: 8 }}
              >
                <T color={C.blue} size={13}>
                  {notification.action.label}
                </T>
              </Pressable>
            )}
          </View>
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
    </View>
  );
}
