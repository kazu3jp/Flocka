import { useScreenFocusEffect } from "../../components/screen-focus";
import { useCallback, useRef, useState } from "react";
import {
  defaultDeco,
  isCardKey,
  type DecoData,
  type State,
} from "@flocka/domain";
import { useConfirmation } from "../../components/pickers";
import { useApp } from "../../store";
import { useAction } from "../sync/use-action";

export type DecorationTab = "pattern" | "frame" | "stickers" | "color";

export function useDecoration(cardKey: string) {
  const { s, d, update, nav, toast, savePreferences } = useApp();
  const [tab, setTab] = useState<DecorationTab>("pattern");
  const { busy, error, run } = useAction();
  const focusedVisit = useRef<{ cardKey: string } | null>(null);
  useScreenFocusEffect(
    useCallback(() => {
      focusedVisit.current = { cardKey };
      return () => {
        focusedVisit.current = null;
      };
    }, [cardKey]),
  );
  const { ask, dialog } = useConfirmation();
  const known = isCardKey(cardKey);
  const savedDecoration = (state: State) =>
    known && Object.hasOwn(state.deco, cardKey) ? state.deco[cardKey] : null;
  // "元に戻す" restores the design this visit started from, not the default.
  const [initial] = useState(() => {
    const saved = savedDecoration(s);
    return saved ? (JSON.parse(JSON.stringify(saved)) as DecoData) : null;
  });
  const card = d.cards[cardKey];
  const decoration = savedDecoration(s) ?? defaultDeco();
  const changed =
    JSON.stringify(savedDecoration(s)) !== JSON.stringify(initial);
  const select = (key: string) => {
    if (busy || !known) return;
    let limitReached = false;
    update((state) => {
      const current = savedDecoration(state) ?? defaultDeco();
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
    if (busy || !known || !changed) return;
    ask(
      "元に戻す？",
      "この画面を開いたときのデコに戻します。",
      () =>
        update((state) => {
          if (initial)
            state.deco[cardKey] = JSON.parse(
              JSON.stringify(initial),
            ) as DecoData;
          else delete state.deco[cardKey];
        }),
      "元に戻す",
    );
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
    canReset: known && changed,
    dialog,
    finish,
    busy,
    error,
    back: nav.pop,
  };
}
