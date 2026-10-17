import { AuthProvider, useAuth } from "../features/auth/provider";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { DelaGothicOne_400Regular } from "@expo-google-fonts/dela-gothic-one/400Regular";
import { ZenKakuGothicNew_500Medium } from "@expo-google-fonts/zen-kaku-gothic-new/500Medium";
import { ZenKakuGothicNew_700Bold } from "@expo-google-fonts/zen-kaku-gothic-new/700Bold";
import {
  ActivityIndicator,
  Platform,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "../store";
import { C, T } from "../components/ui";
import { AppFrame } from "../components/app-frame";

export default function RootLayout() {
  const [loaded, error] = useFonts({
      DelaGothicOne_400Regular,
      ZenKakuGothicNew_500Medium,
      ZenKakuGothicNew_700Bold,
    }),
    { width, height } = useWindowDimensions(),
    desktop = Platform.OS === "web" && width > 760,
    framed = Platform.OS === "web" && width > 500;
  if (error)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <T color={C.ink}>
          フォントを読み込めませんでした：{error.message}。再起動してください。
        </T>
      </View>
    );
  if (!loaded)
    return (
      <View
        style={{ flex: 1, backgroundColor: C.blue, justifyContent: "center" }}
      >
        <ActivityIndicator
          color={C.yellow}
          accessibilityLabel="フォントを読み込み中"
        />
      </View>
    );
  return (
    <SafeAreaProvider>
      <View
        style={{
          flex: 1,
          backgroundColor: C.stage,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
        }}
      >
        <StatusBar style="light" />
        {desktop && (
          <View style={{ width: 250, gap: 10 }}>
            <T display size={26} style={{ lineHeight: 36.4 }}>
              強みカードを集めて、{"\n"}自己PRにする。
            </T>
            <T color={C.pale} size={13} style={{ lineHeight: 21.45 }}>
              仲間から届いた封筒を開ける前に、どの強みの証言か予想するゲーム。2人以上の証言がそろったカードから、自己PRの下書きが書き上がります。
            </T>
          </View>
        )}
        <AppFrame
          borderRadius={framed ? 48 : 0}
          style={{
            width: framed ? 390 : "100%",
            height: framed ? Math.min(844, height - 48) : "100%",
            backgroundColor: C.blue,
            borderRadius: framed ? 48 : 0,
            overflow: "hidden",
            boxShadow: framed
              ? `0 0 0 10px ${C.ink}, 0 40px 90px #0006`
              : "none",
          }}
        >
          <AuthProvider>
            <AccountProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade",
                  gestureEnabled: false,
                  contentStyle: { backgroundColor: C.blue },
                }}
              />
            </AccountProvider>
          </AuthProvider>
        </AppFrame>
      </View>
    </SafeAreaProvider>
  );
}

function AccountProvider({ children }: { children: React.ReactNode }) {
  const { data } = useAuth();
  const scope = data?.user.id ?? "signed-out";
  return (
    <Provider key={scope} storageScope={scope}>
      {children}
    </Provider>
  );
}
