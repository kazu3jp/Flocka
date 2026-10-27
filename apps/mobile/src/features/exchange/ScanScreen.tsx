import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform, View, useWindowDimensions } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useScreenFocused } from "../../components/screen-focus";
import QRCode from "react-native-qrcode-svg";
import {
  Avatar,
  Board,
  Btn,
  C,
  Choice,
  FIXED_LOOKING_BOARD,
  Header,
  InlineError,
  LAYOUT,
  Panel,
  S,
  T,
} from "../../components/ui";
import { useAppWidth } from "../../components/app-frame";
import { fitDisplayName } from "../../components/responsive-scale";
import { inviteQR, parseInviteQR } from "@flocka/domain";
import { useApp } from "../../store";
import { UserFacingError } from "../sync/user-facing-error";
import {
  CAMERA_PERMISSION_COPY,
  cameraPermissionView,
  shouldAutoRequestCamera,
} from "./camera-permission";
import { useInvite } from "./use-invite";
import { useAction } from "../sync/use-action";
import { useStartExchange } from "./use-start-exchange";
import { useScreenVisit } from "../sync/use-screen-visit";

const RESCAN_DELAY_MS = 2000;

/**
 * The QR code and the camera take a share of the screen height, up to their
 * size on a tall phone, so the rest of the screen stays in view on a short one.
 */
function useScanSizes() {
  const { height, fontScale } = useWindowDimensions();
  const panelInnerWidth =
    useAppWidth() - 2 * LAYOUT.screenPadding - 2 * LAYOUT.panelPadding;
  return {
    qr: clamp(Math.round(height * 0.3), 160, Math.min(230, panelInnerWidth)),
    camera: clamp(Math.round(height * 0.4), 220, 320),
    panelInnerWidth,
    fontScale,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function Scan() {
  const { s, nav } = useApp(),
    [mode, setMode] = useState<"show" | "scan">("show"),
    [permission, requestPermission] = useCameraPermissions(),
    focused = useScreenFocused(),
    [requesting, setRequesting] = useState(false),
    [requestFailed, setRequestFailed] = useState(false),
    asked = useRef(false),
    scanned = useRef(false),
    rescanTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    startVisit = useScreenVisit(),
    {
      invite,
      expired,
      error: inviteError,
      busy: creating,
      renew,
    } = useInvite(),
    { busy, error, run } = useAction(),
    sizes = useScanSizes(),
    startExchange = useStartExchange(),
    // Remounting the camera clears a code still in view, so a rescan starts fresh.
    [cameraKey, setCameraKey] = useState(0);
  useEffect(
    () => () => {
      if (rescanTimer.current) clearTimeout(rescanTimer.current);
    },
    [],
  );
  const permissionView = cameraPermissionView({
    status: permission ? permission.status : null,
    canAskAgain: permission ? permission.canAskAgain : true,
    requestFailed,
    requesting,
  });
  const askForCamera = async () => {
    setRequesting(true);
    setRequestFailed(false);
    try {
      await requestPermission();
    } catch {
      setRequestFailed(true);
    } finally {
      setRequesting(false);
    }
  };
  // Ask when the person opens the scan tab on this screen. The browser keeps
  // its own button so a prompt never appears without a tap.
  useEffect(() => {
    if (Platform.OS === "web" || mode !== "scan" || !focused) return;
    if (!shouldAutoRequestCamera(permissionView, asked.current)) return;
    asked.current = true;
    void askForCamera();
  });
  const permissionAction = () => {
    if (permissionView === "settings")
      return void Linking.openSettings().catch(() => setRequestFailed(true));
    void askForCamera();
  };
  const receive = (value: string) => {
    if (scanned.current) return;
    scanned.current = true;
    let opened = false;
    void run(async () => {
      const sameVisit = startVisit();
      const code = parseInviteQR(value);
      if (!code)
        throw new UserFacingError("Flockaの交換用QRを読み取ってください");
      opened = await startExchange(code, sameVisit);
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
    <Board scroll contentStyle={FIXED_LOOKING_BOARD}>
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
                size={sizes.qr}
                color={C.ink}
                backgroundColor={C.paper}
              />
            ) : (
              <T color={C.ink}>
                {creating
                  ? "交換コードを作成中…"
                  : expired
                    ? "交換コードの有効期限が切れました。「QRを更新する」を押してください。"
                    : "交換コードを作成できませんでした。「QRを更新する」を押してください。"}
              </T>
            )}
            <Avatar name={s.profile.name} avatar={s.profile.avatar} size={56} />
            <T
              display
              color={C.ink}
              size={fitDisplayName({
                name: s.profile.name,
                availableWidth: sizes.panelInnerWidth,
                maxSize: 20,
                minSize: 14,
                fontScale: sizes.fontScale,
              })}
              style={{ textAlign: "center" }}
            >
              {s.profile.name}
            </T>
            {invite && (
              <T color={C.muted} size={12}>
                有効期限{" "}
                {new Date(invite.localExpiresAt).toLocaleTimeString("ja-JP")}
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
          {permissionView === "granted" && focused ? (
            <View
              style={{
                height: sizes.camera,
                borderWidth: 3,
                borderColor: C.yellow,
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <CameraView
                key={cameraKey}
                style={S.fill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => receive(data)}
              />
            </View>
          ) : (
            <Panel style={S.gap}>
              <T color={C.ink}>
                {permissionView === "granted"
                  ? "カメラを準備しています…"
                  : CAMERA_PERMISSION_COPY[permissionView].message}
              </T>
              {permissionView !== "granted" &&
              CAMERA_PERMISSION_COPY[permissionView].button ? (
                <Btn
                  label={CAMERA_PERMISSION_COPY[permissionView].button}
                  onPress={permissionAction}
                />
              ) : null}
            </Panel>
          )}
          <T
            size={13}
            accessibilityLiveRegion="polite"
            style={{ textAlign: "center" }}
          >
            {busy
              ? "読み取りました。交換を始めています…"
              : "相手のQRを枠の中に合わせてください"}
          </T>
          <Btn
            plain
            small
            label="もう一度読み取る"
            disabled={busy}
            onPress={() => {
              if (rescanTimer.current) clearTimeout(rescanTimer.current);
              scanned.current = false;
              setCameraKey((key) => key + 1);
            }}
          />
        </View>
      )}
      <InlineError text={error || inviteError} />
    </Board>
  );
}
