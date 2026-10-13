import React, { useRef, useState } from "react";
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
  LinkButton,
  Panel,
  S,
  Sheet,
  T,
} from "../../components/ui";
import { PEOPLE, parseDemoQR, startExchange } from "@flocka/domain";
import { useApp } from "../../store";

export function Scan() {
  const { s, nav, update, toast } = useApp(),
    [mode, setMode] = useState<"show" | "scan">("show"),
    [examples, setExamples] = useState(false),
    [permission, requestPermission] = useCameraPermissions(),
    scanned = useRef(false),
    focused = useIsFocused();
  const receive = (data: string) => {
    if (scanned.current) return;
    const peerId = parseDemoQR(data);
    if (!peerId) {
      toast(
        "このデモ用のQRではありません。実際のユーザー交換はサーバー未接続です。",
      );
      scanned.current = true;
      return;
    }
    const id = update((x) => startExchange(x, peerId));
    if (!id) {
      toast("ブロックした人とは交換できません");
      scanned.current = true;
      return;
    }
    scanned.current = true;
    nav.replace("confirm", { cid: id });
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
        <>
          <View style={{ flex: 1, justifyContent: "center", gap: 20 }}>
            <Panel
              style={{ alignItems: "center", gap: 16, paddingVertical: 30 }}
            >
              <QRCode
                value={JSON.stringify({
                  type: "flocka-local-profile",
                  version: 1,
                  name: s.profile.name,
                  role: s.profile.role,
                  self: s.self,
                })}
                size={230}
                color={C.ink}
                backgroundColor={C.paper}
              />
              <Avatar
                name={s.profile.name}
                avatar={s.profile.avatar}
                size={56}
              />
              <T display color={C.ink} size={20}>
                {s.profile.name}
              </T>
            </Panel>
            <T size={12} style={{ textAlign: "center" }}>
              プロフィールのQRです。実際のユーザー同士の交換・承認にはサーバー接続が必要です。
            </T>
          </View>
        </>
      ) : (
        <>
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
                <T color={C.ink}>QRの読み取りにカメラを使います。</T>
                <Btn
                  label="カメラを許可する"
                  onPress={() => {
                    requestPermission()
                      .then((p) => {
                        if (!p.granted)
                          toast(
                            "カメラが許可されていません。端末の設定で許可してください。",
                          );
                      })
                      .catch(() => toast("カメラを利用できませんでした"));
                  }}
                />
              </Panel>
            )}
            <Btn
              plain
              small
              label="もう一度読み取る"
              onPress={() => {
                scanned.current = false;
                toast("読み取りを再開しました");
              }}
            />
            <T size={12}>
              別端末に表示した体験用QRを読み取ると、元のデモ交換へ進みます。
            </T>
          </View>
        </>
      )}
      <LinkButton label="体験用QRを見る" onPress={() => setExamples(true)} />
      {examples && (
        <Sheet title="体験用の相手QR" onClose={() => setExamples(false)}>
          <T size={13}>別端末のこの画面をカメラで読み取ってください。</T>
          {Object.entries(PEOPLE).map(([id, p]) => (
            <Panel key={id} style={{ alignItems: "center", gap: 8 }}>
              <QRCode
                value={`flocka-demo://peer/${id}`}
                size={150}
                color={C.ink}
                backgroundColor={C.paper}
              />
              <T color={C.ink}>{p.name}</T>
            </Panel>
          ))}
        </Sheet>
      )}
    </Board>
  );
}
