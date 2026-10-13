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
import { useApp } from "../../store";
import Nearby from "../../../modules/flocka-nearby/src/FlockaNearbyModule";
import { useInvite } from "./use-invite";
import { useAction } from "../sync/use-action";
export function NearbyScreen() {
  const { api, refresh, nav } = useApp(),
    { invite, error: inviteError, renew } = useInvite(),
    focused = useIsFocused(),
    [peers, setPeers] = useState<
      Record<string, { player: RemotePlayer; code: string; seenAt: number }>
    >({}),
    [radioError, setRadioError] = useState<string | null>(null),
    { busy, error, run } = useAction();
  useEffect(() => {
    if (!focused || !invite || !Nearby) return;
    const bluetooth = Nearby;
    let active = true;
    const inFlight = new Set<string>();
    const discovered = bluetooth.addListener("onPeer", ({ code }) => {
      if (!active || inFlight.has(code)) return;
      inFlight.add(code);
      void api
        .previewInvite(code)
        .then((player) => {
          if (active)
            setPeers((peers) => ({
              ...peers,
              [player.id]: { player, code, seenAt: Date.now() },
            }));
        })
        .catch((error) => {
          if (active)
            setRadioError(
              error instanceof Error
                ? error.message
                : "相手を確認できませんでした",
            );
        })
        .finally(() => inFlight.delete(code));
    });
    const failures = bluetooth.addListener("onError", ({ message }) => {
      if (active) setRadioError(message);
    });
    const start = async () => {
      const permissions = await bluetooth.requestPermissions();
      if (!permissions.granted)
        throw new Error("近距離交換にはBluetoothの許可が必要です");
      await bluetooth.start(invite.code);
      if (active) setRadioError(null);
    };
    void start().catch((error) => {
      if (active)
        setRadioError(
          error instanceof Error ? error.message : "Bluetoothを利用できません",
        );
    });
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void start().catch((error) => {
          if (active) setRadioError(String(error.message || error));
        });
      else void bluetooth.stop().catch(() => {});
    });
    const timer = setInterval(
      () =>
        setPeers((peers) =>
          Object.fromEntries(
            Object.entries(peers).filter(
              ([, peer]) => Date.now() - peer.seenAt < 25_000,
            ),
          ),
        ),
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
              const exchange = await api.startExchange(code);
              await refresh();
              nav.replace("confirm", { cid: exchange.id });
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
