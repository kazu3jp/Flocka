import React, { useEffect, useState } from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import { useIsFocused } from "expo-router";
import {
  Board,
  Btn,
  C,
  Header,
  Icon,
  Panel,
  S,
  T,
  Avatar,
} from "../../components/ui";
import type { RemotePlayer } from "@flocka/domain";
import { ApiClientError } from "@flocka/api-client";
import { useApp } from "../../store";
import Nearby from "../../../modules/flocka-nearby/src/FlockaNearbyModule";
import { useInvite } from "./use-invite";
import { useAction } from "../sync/use-action";
import { useScreenVisit } from "../sync/use-screen-visit";
import { userFacingError } from "../sync/user-facing-error";

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
export function NearbyScreen() {
  const { api, refresh, nav } = useApp(),
    { invite, error: inviteError, renew } = useInvite(),
    focused = useIsFocused(),
    [peers, setPeers] = useState<
      Record<string, { player: RemotePlayer; code: string; seenAt: number }>
    >({}),
    [radioError, setRadioError] = useState<string | null>(null),
    { busy, error, run } = useAction(),
    startVisit = useScreenVisit();
  useEffect(() => {
    if (!focused || !invite || !Nearby) return;
    const bluetooth = Nearby;
    let active = true;
    // Peers re-advertise continuously; each code is checked with the API once per TTL.
    const previews = new Map<
      string,
      { player: RemotePlayer | null; expiresAt: number } | "pending"
    >();
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
          if (active) markSeen(player, code);
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
            setRadioError(userFacingError(error, "相手を確認できませんでした"));
        });
    });
    // Native radio errors carry platform details; show what the user can do instead.
    const failures = bluetooth.addListener("onError", () => {
      if (active) setRadioError(BLUETOOTH_UNAVAILABLE_MESSAGE);
    });
    const start = async () => {
      const permissions = await bluetooth.requestPermissions();
      if (!active) return;
      if (!permissions.granted) {
        setRadioError(BLUETOOTH_PERMISSION_MESSAGE);
        return;
      }
      await bluetooth.start(invite.code);
      if (active) setRadioError(null);
    };
    const startRadio = () =>
      void start().catch(() => {
        if (active) setRadioError(BLUETOOTH_UNAVAILABLE_MESSAGE);
      });
    startRadio();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") startRadio();
      else void bluetooth.stop().catch(() => {});
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
      clearInterval(timer);
      listener.remove();
      discovered.remove();
      failures.remove();
      void bluetooth.stop().catch(() => {});
    };
  }, [api, focused, invite]);
  return (
    <Board scroll>
      <Header title="近くの人と交換" onBack={nav.pop} />
      <View style={{ alignItems: "center", padding: 14 }}>
        <Icon name="radar" size={60} />
      </View>
      {Platform.OS === "web" ? (
        <T>近距離交換はiOS・Androidアプリで利用できます。</T>
      ) : !Nearby ? (
        <T>
          Bluetooth機能を含む開発ビルドを起動してください。Expo
          Goでは利用できません。
        </T>
      ) : (
        <T size={13}>
          近くでこの画面を開いている人をBluetoothで探しています。画面を閉じると探索と公開を停止します。
        </T>
      )}
      {(radioError || inviteError || error) && (
        <T color={C.yellow} accessibilityRole="alert">
          {radioError || inviteError || error}
        </T>
      )}
      {Object.values(peers).map(({ player, code }) => (
        <Pressable
          key={player.id}
          accessibilityRole="button"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const sameVisit = startVisit();
              const exchange = await api.startExchange(code);
              await refresh();
              // A late response must not replace a later visit or another screen.
              if (sameVisit()) nav.replace("confirm", { cid: exchange.id });
            })
          }
        >
          <Panel style={S.row}>
            <Avatar name={player.profile.name} avatar={player.profile.avatar} />
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
      ))}
      {Nearby && !Object.keys(peers).length && (
        <T size={13}>交換できる人が見つかると、ここに表示されます。</T>
      )}
      {Nearby && (
        <Btn
          plain
          small
          label="探索をやり直す"
          disabled={busy}
          onPress={() => void renew()}
        />
      )}
    </Board>
  );
}
export { NearbyScreen as Nearby };
