import type { createAuthRuntime } from "../../tests/helpers/auth-runtime";
import { AV_COLORS } from "@flocka/domain";

type Runtime = Awaited<ReturnType<typeof createAuthRuntime>>;
export type Scenario = "onboarding" | "empty" | "collected";

/** Test-only players are registered, verified and populated through real APIs. */
export async function seedScenario(
  runtime: Runtime,
  scenario: Scenario,
  namespace = "",
) {
  const email = (name: string) =>
    `vrt.${namespace ? namespace + "." : ""}${name}@example.test`;
  if (scenario === "onboarding") {
    const session = await runtime.authenticate("ハルカ", email("onboarding"));
    return { cookie: session.cookie };
  }
  const owner = await runtime.register("ハルカ", email(scenario));
  const profile = {
    ...owner.player.profile,
    role: "ハッカソンでよく実装担当",
    interests: ["Web開発", "チーム開発", "AI・データ"],
  };
  await owner.api.updateProfile(profile, ["impl", "focus"]);
  if (scenario === "empty")
    return { cookie: owner.cookie, playerId: owner.player.id };
  const peers = await Promise.all([
    runtime.register("ミナト", email("minato")),
    runtime.register("ソラ", email("sora")),
    runtime.register("カエデ", email("kaede")),
  ]);
  const peerProfiles = [
    {
      role: "UIデザインを勉強中",
      motif: "cat",
      color: AV_COLORS[1],
      interests: ["UI/UX", "写真"],
      self: ["design", "idea"],
    },
    {
      role: "Webアプリを個人開発中",
      motif: "rocket",
      color: AV_COLORS[3],
      interests: ["Web開発", "ゲーム"],
      self: ["impl", "focus"],
    },
    {
      role: "学園祭の企画チーム",
      motif: "leaf",
      color: AV_COLORS[2],
      interests: ["プロダクト企画", "旅行"],
      self: ["bridge", "planning"],
    },
  ];
  for (const [index, peer] of peers.entries()) {
    const profile = peerProfiles[index];
    await peer.api.updateProfile(
      {
        ...peer.player.profile,
        role: profile.role,
        interests: profile.interests,
        avatar: { type: "motif", motif: profile.motif, color: profile.color },
      },
      profile.self,
    );
  }
  const contexts = [
    ["学内ハッカソン", "同じチームでUIを担当"],
    ["学内ハッカソン", "発表資料を一緒に作った"],
    ["開発勉強会", "懇親会で隣の席だった"],
  ];
  const exchanges = [];
  for (const [index, peer] of peers.entries()) {
    const invitation = await owner.api.createInvite();
    const exchange = await peer.api.startExchange(invitation.code);
    await owner.api.approveExchange(
      exchange.id,
      ...(contexts[index] as [string, string]),
    );
    await peer.api.approveExchange(
      exchange.id,
      ...(contexts[index] as [string, string]),
    );
    exchanges.push(exchange.id);
  }
  const first = await peers[0].api.sendImpression(
    exchanges[0],
    "bridge",
    "分かりやすく伝えてくれる",
    "UIの相談をしたら、技術の話をかみ砕いて説明してくれた",
  );
  const second = await peers[1].api.sendImpression(
    exchanges[1],
    "bridge",
    "分かりやすく伝えてくれる",
    "発表の前に、みんなの意見を整理してまとめてくれた",
  );
  const implementation = await peers[0].api.sendScene(
    exchanges[0],
    "impl",
    "話したアイデアを、その日のうちに動く形にしてくれた",
  );
  const unopened = await peers[2].api.sendImpression(
    exchanges[2],
    "warm",
    "話しやすい",
    "初対面なのに、緊張せずに話せた",
  );
  await owner.api.openTestimony(first.id, "impl");
  await owner.api.openTestimony(second.id, "focus");
  await owner.api.openTestimony(implementation.id, "impl");
  const snapshot = await owner.api.getSnapshot();
  await owner.api.savePreferences(
    { ...snapshot.preferences.data, showcase: ["bridge", "impl", "focus"] },
    snapshot.preferences.revision,
  );
  return {
    cookie: owner.cookie,
    playerId: owner.player.id,
    exchanges,
    pieceId: first.id,
    unopenedId: unopened.id,
  };
}
