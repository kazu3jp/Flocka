import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, View } from "react-native";
import { useScreenFocused } from "../../components/screen-focus";
import {
  Board,
  Btn,
  C,
  Header,
  Icon,
  Panel,
  S,
  SP,
  T,
  Avatar,
} from "../../components/ui";
import { StaggerItem } from "../../components/motion";
import type { RemotePlayer } from "@flocka/domain";
import { ApiClientError } from "@flocka/api-client";
import { useApp } from "../../store";
import Nearby from "../../../modules/flocka-nearby/src/FlockaNearbyModule";
import type { NearbyErrorCode } from "../../../modules/flocka-nearby/src/FlockaNearby.types";
import { useInvite } from "./use-invite";
import { useAction } from "../sync/use-action";
import { userFacingError } from "../sync/user-facing-error";
import { NearbyRadarPanel } from "./NearbyRadarPanel";
import { NearbyTips, NearbyUnavailable } from "./NearbyTips";
import {
  NEARBY_TIPS_AFTER_MS,
  nearbyStatus,
  showsNearbyTips,
} from "./nearby-status";
import { useSearchedFor } from "./use-searched-for";
import { createNearbyRadioSession } from "./nearby-radio-session";
import {
  createNearbyExchange,
  type NearbyExchangeSignal,
} from "./nearby-exchange";

/** How long a checked code is trusted before asking the API again. */
const PREVIEW_TTL_MS = 60_000;
const OFFLINE_RETRY_MS = 10_000;
/** A peer disappears when its advertisement has not been seen for this long. */
const PEER_VISIBLE_MS = 25_000;
/** Re-advertisements only refresh `seenAt` this often, to avoid redrawing on every packet. */
const SEEN_REFRESH_INTERVAL_MS = 5000;
const BLUETOOTH_PERMISSION_MESSAGE = "近距離交換にはBluetoothの許可が必要です";
const BLUETOOTH_UNAVAILABLE_MESSAGE =
  "Bluetoothを利用できません。Bluetoothがオンになっているか確認してください";
const WEB_UNAVAILABLE_MESSAGE =
  "近距離交換はiOS・Androidアプリで利用できます。";
const NO_MODULE_MESSAGE =
  "Bluetooth機能を含む開発ビルドを起動してください。Expo Goでは利用できません。";
const SETTINGS_FAILED_MESSAGE =
  "設定を開けませんでした。端末の設定アプリから変更してください";
/** Where 「設定を開く」 leads. Bluetooth and Location screens can only be opened on Android. */
type SettingsTarget = "app" | "bluetooth" | "location";
type RadioError = { message: string; settings?: SettingsTarget };
const ANDROID_SETTINGS_INTENTS = {
  bluetooth: "android.settings.BLUETOOTH_SETTINGS",
  location: "android.settings.LOCATION_SOURCE_SETTINGS",
} as const;

/** Native radio errors carry platform details; show what the user can do instead. */
function nearbyRadioError(code: unknown): RadioError {
  const android = Platform.OS === "android";
  switch (code as NearbyErrorCode) {
    case "PERMISSION_DENIED":
      return {
        message: "Bluetoothの許可がありません。設定から許可してください",
        settings: "app",
      };
    case "BLUETOOTH_OFF":
      return {
        message: "Bluetoothがオフです。オンにすると探索を再開します",
        settings: android ? "bluetooth" : undefined,
      };
    case "LOCATION_OFF":
      return {
        message:
          "この端末で近くの人を探すには位置情報をオンにする必要があります。オンにすると探索を再開します",
        settings: android ? "location" : undefined,
      };
    case "UNSUPPORTED":
      return { message: "この端末は近距離交換に対応していません" };
    default:
      return { message: BLUETOOTH_UNAVAILABLE_MESSAGE };
  }
}
const nativeErrorCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error
    ? error.code
    : undefined;
function openSettings(target: SettingsTarget) {
  if (target === "app" || Platform.OS !== "android")
    return Linking.openSettings();
  return Linking.sendIntent(ANDROID_SETTINGS_INTENTS[target]);
}

export function NearbyScreen() {
  const { api, nav, s, refresh, toast } = useApp(),
    { invite, error: inviteError, renew } = useInvite(),
    focused = useScreenFocused(),
    [peers, setPeers] = useState<
      Record<string, { player: RemotePlayer; code: string; seenAt: number }>
    >({}),
    [radioError, setRadioError] = useState<RadioError | null>(null),
    // A peer's code that could not be checked: shown, but scanning itself is still live.
    [peerError, setPeerError] = useState<string | null>(null),
    // `starting`: start() was requested and has not answered. `ready`: scanning really runs.
    [starting, setStarting] = useState(false),
    [ready, setReady] = useState(false),
    { busy, error, run } = useAction(),
    coordinator = useRef<ReturnType<typeof createNearbyExchange> | null>(null),
    [pendingSignal, setPendingSignal] = useState<NearbyExchangeSignal | null>(
      null,
    );
  const exchangeActions = useRef({ refresh, nav, toast });
  useEffect(() => {
    exchangeActions.current = { refresh, nav, toast };
  }, [refresh, nav, toast]);
  useEffect(() => {
    if (!focused || !invite || !Nearby) return;
    const bluetooth = Nearby;
    let active = true;
    const radio = createNearbyRadioSession(
      {
        requestPermissions: () => bluetooth.requestPermissions(),
        start: () => bluetooth.start(invite.code),
        stop: () => bluetooth.stop(),
        onStarting: setStarting,
        onReady: (ready) => {
          if (ready) {
            setRadioError(null);
            setPeerError(null);
          }
          setReady(ready);
        },
        onDenied: (permissions) =>
          setRadioError({
            message: BLUETOOTH_PERMISSION_MESSAGE,
            settings: permissions.canAskAgain ? undefined : "app",
          }),
        onError: (error) =>
          setRadioError(nearbyRadioError(nativeErrorCode(error))),
      },
      AppState.currentState !== "background",
    );
    // Peers re-advertise continuously; each code is checked with the API once per TTL.
    const previews = new Map<
      string,
      { player: RemotePlayer | null; expiresAt: number } | "pending"
    >();
    const exchange = createNearbyExchange({
      create: (code) => api.startExchange(code),
      notify: (code, id) => bluetooth.notifyExchangeStarted(code, id),
      notificationFailed: () =>
        exchangeActions.current.toast(
          "交換は保存済みですがBluetooth通知は未確認です。相手に反映されない場合は、双方のアプリを最新版へ更新してください",
        ),
      get: (id) => api.getExchange(id),
      peerId: async (code) => {
        const cached = previews.get(code);
        if (cached && cached !== "pending" && cached.player)
          return cached.player.id;
        return (await api.previewInvite(code)).id;
      },
      refresh: () => exchangeActions.current.refresh(),
      open: (id) => exchangeActions.current.nav.replace("confirm", { cid: id }),
    });
    coordinator.current = exchange;
    const exchangeStarted = bluetooth.addListener(
      "onExchangeStarted",
      (signal) => {
        if (!active) return;
        void exchange.receive(signal).catch((reason) => {
          if (!active) return;
          setPendingSignal(signal);
          setPeerError(userFacingError(reason, "交換の確認に失敗しました"));
        });
      },
    );
    const markSeen = (player: RemotePlayer, code: string) =>
      setPeers((peers) => {
        const now = Date.now(),
          current = peers[player.id];
        if (
          current?.code === code &&
          now - current.seenAt < SEEN_REFRESH_INTERVAL_MS
        )
          return peers;
        return { ...peers, [player.id]: { player, code, seenAt: now } };
      });
    const discovered = bluetooth.addListener("onPeer", ({ code }) => {
      if (!active) return;
      const cached = previews.get(code);
      if (cached === "pending") return;
      if (cached && Date.now() < cached.expiresAt) {
        if (cached.player) markSeen(cached.player, code);
        return;
      }
      previews.set(code, "pending");
      void api
        .previewInvite(code)
        .then((player) => {
          previews.set(code, {
            player,
            expiresAt: Date.now() + PREVIEW_TTL_MS,
          });
          if (active) {
            setPeerError(null);
            markSeen(player, code);
          }
        })
        .catch((error) => {
          // A rejected code stays quiet until the TTL instead of failing on every advertisement.
          // Network failures are retried sooner than a code the server rejected.
          const offline = error instanceof ApiClientError && error.status === 0;
          previews.set(code, {
            player: null,
            expiresAt:
              Date.now() + (offline ? OFFLINE_RETRY_MS : PREVIEW_TTL_MS),
          });
          if (active)
            setPeerError(userFacingError(error, "相手を確認できませんでした"));
        });
    });
    // Bluetooth or Location turned off: the native session pauses and resumes by itself (onReady).
    const failures = bluetooth.addListener("onError", ({ code }) => {
      if (!active) return;
      setRadioError(nearbyRadioError(code));
      setReady(false);
      setPeers({});
    });
    const resumed = bluetooth.addListener("onReady", () => {
      radio.ready();
    });
    radio.start();
    // Android permission activities can report background, even for existing grants.
    // Keep the permission attempt single-flight; only an actual radio is stopped.
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        radio.background();
      } else if (state === "active") {
        radio.foreground();
      }
    });
    const timer = setInterval(
      () =>
        setPeers((peers) => {
          const now = Date.now(),
            visible = Object.entries(peers).filter(
              ([, peer]) => now - peer.seenAt < PEER_VISIBLE_MS,
            );
          // Keep the same object when nobody expired so the list does not redraw.
          return visible.length === Object.keys(peers).length
            ? peers
            : Object.fromEntries(visible);
        }),
      5000,
    );
    return () => {
      active = false;
      exchange.dispose();
      if (coordinator.current === exchange) coordinator.current = null;
      setPendingSignal(null);
      exchangeStarted.remove();
      setReady(false);
      setStarting(false);
      clearInterval(timer);
      listener.remove();
      discovered.remove();
      failures.remove();
      resumed.remove();
      radio.dispose();
    };
  }, [api, focused, invite]);
  const peerList = Object.values(peers);
  const supported = Platform.OS !== "web";
  const status = nearbyStatus({
    supported,
    hasModule: Boolean(Nearby),
    starting: starting || (focused && !invite && !inviteError),
    ready,
    error: Boolean(radioError || inviteError),
    peerCount: peerList.length,
    focused,
  });
  const searchedLong = useSearchedFor(
    status === "searching",
    NEARBY_TIPS_AFTER_MS,
  );
  const message =
    error ?? radioError?.message ?? inviteError ?? peerError ?? null;
  const scanQr = () => nav.replace("scan");
  return (
    <Board scroll>
      <Header title="近くの人と交換" onBack={nav.pop} />
      <NearbyRadarPanel
        status={status}
        peerCount={peerList.length}
        message={message}
        name={s.profile.name}
        avatar={s.profile.avatar}
      />
      {!supported ? (
        <NearbyUnavailable message={WEB_UNAVAILABLE_MESSAGE} onScan={scanQr} />
      ) : !Nearby ? (
        <NearbyUnavailable message={NO_MODULE_MESSAGE} onScan={scanQr} />
      ) : (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: SP.sm,
            minHeight: 44,
          }}
        >
          {radioError?.settings ? (
            <Btn
              plain
              small
              label="設定を開く"
              onPress={() => {
                const target = radioError.settings;
                if (!target) return;
                void openSettings(target).catch(() =>
                  setRadioError({ message: SETTINGS_FAILED_MESSAGE }),
                );
              }}
            />
          ) : null}
          {/* Searching runs and renews its code by itself; only a failure that
              settings cannot fix needs a fresh start. */}
          {inviteError || (radioError && !radioError.settings) ? (
            <Btn
              plain
              small
              label="探索をやり直す"
              disabled={busy}
              onPress={() => void renew()}
            />
          ) : null}
        </View>
      )}
      {pendingSignal ? (
        <Btn
          plain
          label="交換の確認を再試行"
          loading={busy}
          onPress={() =>
            void run(async () => {
              await coordinator.current?.receive(pendingSignal);
            })
          }
        />
      ) : null}
      {peerList.map(({ player, code }, index) => (
        <StaggerItem key={player.id} itemKey={player.id} index={index}>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !ready}
            onPress={() =>
              void run(async () => {
                await coordinator.current?.start(code);
              })
            }
          >
            <Panel style={S.row}>
              <Avatar
                name={player.profile.name}
                avatar={player.profile.avatar}
              />
              <View style={S.fill}>
                <T display color={C.ink} size={17}>
                  {player.profile.name}
                </T>
                <T color={C.muted} size={12}>
                  {player.profile.role}
                </T>
              </View>
              <Icon name="chev" color={C.ink} />
            </Panel>
          </Pressable>
        </StaggerItem>
      ))}
      {showsNearbyTips(status, searchedLong ? NEARBY_TIPS_AFTER_MS : 0) ? (
        <NearbyTips onScan={scanQr} />
      ) : null}
    </Board>
  );
}
export { NearbyScreen as Nearby };
