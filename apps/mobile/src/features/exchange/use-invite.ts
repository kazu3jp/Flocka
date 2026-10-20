import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { useApp } from "../../store";
import { userFacingError } from "../sync/user-facing-error";
export function useInvite() {
  const { api, refresh, nav } = useApp(),
    focused = useIsFocused(),
    [invite, setInvite] = useState<Awaited<
      ReturnType<typeof api.createInvite>
    > | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(true),
    mounted = useRef(true),
    running = useRef(false);
  const renew = useCallback(async () => {
    if (running.current || !mounted.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await api.createInvite();
      if (mounted.current) setInvite(next);
    } catch (error) {
      if (mounted.current)
        setError(userFacingError(error, "交換コードを作成できませんでした"));
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [api]);
  useEffect(() => {
    mounted.current = true;
    running.current = true;
    void api
      .createInvite()
      .then((next) => {
        if (mounted.current) setInvite(next);
      })
      .catch((error) => {
        if (mounted.current)
          setError(userFacingError(error, "交換コードを作成できませんでした"));
      })
      .finally(() => {
        running.current = false;
        if (mounted.current) setBusy(false);
      });
    return () => {
      mounted.current = false;
    };
  }, [api]);
  useEffect(() => {
    if (!invite || !focused) return;
    let active = true,
      checking = false;
    const timer = setInterval(async () => {
      if (!active || checking || AppState.currentState !== "active") return;
      if (Date.parse(invite.expiresAt) <= Date.now()) {
        await renew();
        return;
      }
      checking = true;
      try {
        const status = await api.getInviteStatus(invite.code);
        if (!status.exchange || !active) return;
        // The exchange exists on the server, but the confirm screen reads it from the
        // synced state. A failed refresh keeps polling so the next tick retries it.
        await refresh();
        if (!active || !mounted.current) return;
        active = false;
        setError(null);
        nav.replace("confirm", { cid: status.exchange.id });
      } catch (error) {
        if (active)
          setError(userFacingError(error, "交換の確認に失敗しました"));
      } finally {
        checking = false;
      }
    }, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // Navigation methods are ref-backed; restarting a handshake on each sync would lose its state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, focused, invite, refresh, renew]);
  return { invite, error, busy, renew };
}
