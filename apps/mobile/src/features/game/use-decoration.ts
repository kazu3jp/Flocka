import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { defaultDeco, type DecoData } from "@flocka/domain";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";

export type DecorationTab = "pattern" | "frame" | "stickers" | "color";

export function useDecoration(cardKey: string) {
  const { s, d, update, nav, toast, savePreferences } = useApp();
  const [tab, setTab] = useState<DecorationTab>("pattern");
  const { busy, error, run } = useAction();
  const focusedVisit = useRef<{ cardKey: string } | null>(null);
  useFocusEffect(
    useCallback(() => {
      focusedVisit.current = { cardKey };
      return () => {
        focusedVisit.current = null;
      };
    }, [cardKey]),
  );
  const card = d.cards[cardKey];
  const decoration = s.deco[cardKey] ?? defaultDeco();
  const select = (key: string) => {
    if (busy) return;
    let limitReached = false;
    update((state) => {
      const current = state.deco[cardKey] ?? defaultDeco();
      if (tab !== "stickers") {
        state.deco[cardKey] = { ...current, [tab]: key };
        return;
      }
      if (current.stickers.includes(key)) {
        state.deco[cardKey] = {
          ...current,
          stickers: current.stickers.filter((sticker) => sticker !== key),
        };
        return;
      }
      if (current.stickers.length >= 4) {
        limitReached = true;
        return;
      }
      const positions = ["br", "bl", "tr", "tl"];
      const used = current.stickers.map(
        (sticker, index) =>
          current.layout?.[sticker]?.position ?? positions[index % 4],
      );
      state.deco[cardKey] = {
        ...current,
        stickers: [...current.stickers, key],
        layout: {
          ...current.layout,
          [key]: {
            position:
              positions.find((position) => !used.includes(position)) ?? "br",
            size: 23,
            angle: 12,
          },
        },
      } satisfies DecoData;
    });
    if (limitReached)
      toast("シールは4枚まで。貼っているシールを外すと追加できます");
  };
  const reset = () => {
    if (!busy)
      update((state) => {
        delete state.deco[cardKey];
      });
  };
  const finish = () =>
    run(async () => {
      const visit = focusedVisit.current;
      await savePreferences();
      // A completed save must not pop a later visit or another screen's history.
      if (!visit || visit !== focusedVisit.current) return;
      toast("デコを保存しました");
      nav.pop();
    });
  return {
    card,
    decoration,
    tab,
    setTab,
    select,
    reset,
    finish,
    busy,
    error,
    back: nav.pop,
  };
}
