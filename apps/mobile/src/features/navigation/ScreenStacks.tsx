import React, { Activity, useState } from "react";
import { View } from "react-native";
import type { Entry, NavState, Tab } from "@flocka/domain";
import { S } from "../../components/ui";
import { ScreenVisible } from "../../components/screen-focus";
import { ScreenEntrance, type ScreenEnter } from "../../components/motion";
import {
  AvatarEdit,
  Me,
  Onboarding,
  PieceDetail,
  Pieces,
  SelfEdit,
  Settings,
  SnsLinks,
} from "../profile";
import { Moderation } from "../admin";
import { CardDetail, Deck, Deco, PR } from "../game";
import { Collection } from "../game/CollectionScreen";
import {
  Confirm,
  Connections,
  Exchange,
  Give,
  Memo,
  Nearby,
  Scan,
} from "../exchange";

const TABS: Tab[] = ["find", "exchange", "pr"];
/** Marks a screen kept mounted out of view, so tests can leave it out. */
const HIDDEN_SCREEN_TEST_ID = "hidden-screen";

export function screenFor({ id, params }: Entry) {
  const key = params?.key ?? "",
    cid = params?.cid ?? "",
    entryId = params?.id ?? "";
  switch (id) {
    case "onboarding":
      return <Onboarding />;
    case "deck":
      return <Deck />;
    case "collection":
      return <Collection />;
    case "card":
      return <CardDetail cardKey={key} />;
    case "deco":
      return <Deco cardKey={key} />;
    case "me":
      return <Me />;
    case "avatar":
      return <AvatarEdit />;
    case "selfEdit":
      return <SelfEdit />;
    case "pieces":
      return <Pieces />;
    case "piece":
      return <PieceDetail id={entryId} />;
    case "settings":
      return <Settings />;
    case "sns":
      return <SnsLinks />;
    case "moderation":
      return <Moderation />;
    case "exchange":
      return <Exchange />;
    case "connections":
      return <Connections />;
    case "nearby":
      return <Nearby />;
    case "scan":
      return <Scan />;
    case "confirm":
      return <Confirm cid={cid} />;
    case "give":
      return <Give cid={cid} />;
    case "memo":
      return <Memo />;
    case "pr":
      return <PR />;
  }
}

/** One mounted screen per stack position; new params at a position mean a new screen. */
const entryKey = (tab: Tab, index: number, { id, params }: Entry) =>
  `${tab}/${index}/${id}/${JSON.stringify(params ?? {})}`;

/**
 * Every tab keeps its screen stack mounted, and only the top screen of the
 * current tab is shown. Going back or switching tabs reveals a screen that is
 * already built instead of rebuilding it. Hidden screens keep their state;
 * Activity removes their effects (camera, Bluetooth, polling, animation loops)
 * until they are shown again, and defers their re-renders.
 */
export function ScreenStacks({ nav }: { nav: NavState }) {
  // Going back is the current tab's stack getting shorter.
  const [previous, setPrevious] = useState(nav),
    [enter, setEnter] = useState<ScreenEnter>("rise");
  if (previous !== nav) {
    setPrevious(nav);
    setEnter(
      previous.tab === nav.tab &&
        previous.stacks[nav.tab].length > nav.stacks[nav.tab].length
        ? "back"
        : "push",
    );
  }
  return TABS.flatMap((tab) =>
    nav.stacks[tab].map((entry, index) => {
      const visible = tab === nav.tab && index === nav.stacks[tab].length - 1;
      return (
        <Activity
          key={entryKey(tab, index, entry)}
          mode={visible ? "visible" : "hidden"}
        >
          <ScreenVisible.Provider value={visible}>
            <View
              style={S.fill}
              testID={visible ? undefined : HIDDEN_SCREEN_TEST_ID}
            >
              <ScreenEntrance
                testID="screen-entrance"
                enter={enter === "back" ? "back" : index > 0 ? "push" : "rise"}
              >
                {screenFor(entry)}
              </ScreenEntrance>
            </View>
          </ScreenVisible.Provider>
        </Activity>
      );
    }),
  );
}
