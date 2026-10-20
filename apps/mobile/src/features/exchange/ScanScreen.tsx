import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import {
  Avatar,
  Board,
  Btn,
  C,
  Choice,
  Header,
  Panel,
  S,
  T,
} from "../../components/ui";
import { inviteQR, parseInviteQR } from "@flocka/domain";
import { useApp } from "../../store";
import { useInvite } from "./use-invite";
import { useAction } from "../sync/use-action";
import { useScreenVisit } from "../sync/use-screen-visit";

const RESCAN_DELAY_MS = 2000;
export function Scan() {
  const { s, api, refresh, nav } = useApp(),
    [mode, setMode] = useState<"show" | "scan">("show"),
    [permission, requestPermission] = useCameraPermissions(),
    focused = useIsFocused(),
    scanned = useRef(false),
    rescanTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    startVisit = useScreenVisit(),
    { invite, error: inviteError, busy: creating, renew } = useInvite(),
    { busy, error, run } = useAction();
  useEffect(
    () => () => {
      if (rescanTimer.current) clearTimeout(rescanTimer.current);
    },
    [],
  );
  const receive = (value: string) => {
    if (scanned.current) return;
    scanned.current = true;
    let opened = false;
    void run(async () => {
      const sameVisit = startVisit();
      const code = parseInviteQR(value);
      if (!code) throw new Error("Flockaの交換用QRを読み取ってください");
      const exchange = await api.startExchange(code);
      await refresh();
      // A late response must not replace a later visit or another screen.
      if (!sameVisit()) return;
      opened = true;
      nav.replace("confirm", { cid: exchange.id });
    }).finally(() => {
      if (opened) return;
      // Reopen the camera after the error has been on screen long enough to read,
      // so the same code in view is not resent on every frame.
      if (rescanTimer.current) clearTimeout(rescanTimer.current);
      rescanTimer.current = setTimeout(() => {
        scanned.current = false;
      }, RESCAN_DELAY_MS);
    });
  };
  return (
    <Board>
      <Header title="QRで交換" onBack={nav.pop} />
      <View style={S.row}>
        <View style={S.fill}>
          <Choice
            label="自分のQRを見せる"
            selected={mode === "show"}
            onPress={() => setMode("show")}
          />
        </View>
        <View style={S.fill}>
          <Choice
            label="相手のQRを読み取る"
            selected={mode === "scan"}
            onPress={() => {
              scanned.current = false;
              setMode("scan");
            }}
          />
        </View>
      </View>
      {mode === "show" ? (
        <View style={{ flex: 1, justifyContent: "center", gap: 16 }}>
          <Panel style={{ alignItems: "center", gap: 16, paddingVertical: 28 }}>
            {invite ? (
              <QRCode
                value={inviteQR(invite.code)}
                size={230}
                color={C.ink}
                backgroundColor={C.paper}
              />
            ) : (
              <T color={C.ink}>交換コードを作成中…</T>
            )}
            <Avatar name={s.profile.name} avatar={s.profile.avatar} size={56} />
            <T display color={C.ink} size={20}>
              {s.profile.name}
            </T>
            {invite && (
              <T color={C.muted} size={12}>
                有効期限{" "}
                {new Date(invite.expiresAt).toLocaleTimeString("ja-JP")}
              </T>
            )}
          </Panel>
          <T size={12}>
            相手が読み取ると確認画面が開きます。双方が「交換する」を押すと成立します。
          </T>
          <Btn
            plain
            small
            label="QRを更新する"
            disabled={creating}
            onPress={() => void renew()}
          />
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: "center", gap: 14 }}>
          {permission?.granted && focused ? (
            <View
              style={{
                height: 320,
                borderWidth: 3,
                borderColor: C.yellow,
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <CameraView
                style={S.fill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => receive(data)}
              />
            </View>
          ) : (
            <Panel style={S.gap}>
              <T color={C.ink}>
                相手の交換用QRを読み取るためにカメラを使います。
              </T>
              <Btn
                label="カメラを許可する"
                onPress={() =>
                  void run(async () => {
                    const permission = await requestPermission();
                    if (!permission.granted)
                      throw new Error("端末の設定からカメラを許可してください");
                  })
                }
              />
            </Panel>
          )}
          <Btn
            plain
            small
            label="もう一度読み取る"
            disabled={busy}
            onPress={() => {
              scanned.current = false;
            }}
          />
        </View>
      )}
      {(error || inviteError) && (
        <T color={C.yellow} accessibilityRole="alert">
          {error || inviteError}
        </T>
      )}
    </Board>
  );
}
