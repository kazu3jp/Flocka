import { fresh, type Piece, type State } from "@flocka/domain";

// Test fixture only: sample players never exist in the shipped app.
export function sampleState(): State {
  const x = fresh(),
    at = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
  x.onboarded = true;
  x.profile = {
    ...x.profile,
    name: "ハルカ",
    role: "ハッカソンでよく実装担当",
    interests: ["Web開発", "チーム開発", "AI・データ"],
  };
  x.self = ["impl", "focus"];
  const ctx: Record<string, [string, string]> = {
    "mock-a": ["学内ハッカソン", "同じチームでUIを担当"],
    "mock-b": ["学内ハッカソン", "発表資料を一緒に作った"],
    "mock-c": ["開発勉強会", "懇親会で隣の席だった"],
  };
  x.connections = Object.entries(ctx).map(([peerId, [place, trigger]], i) => ({
    id: "c-" + peerId,
    peerId,
    status: "accepted",
    myApproved: true,
    vibe: null,
    later: false,
    exchangedAt: at(30 - i),
    context: { place, trigger },
  }));
  const v = (
    id: string,
    fromId: string,
    card: string,
    label: string,
    text: string,
    opened: boolean,
    guess: string | null,
    h: number,
  ): Piece => ({
    id,
    fromId,
    card,
    label,
    text,
    opened,
    guess,
    kind: "vibe",
    visibility: "private",
    createdAt: at(h),
  });
  x.vibes = [
    v(
      "v1",
      "mock-a",
      "bridge",
      "分かりやすく伝えてくれる",
      "UIの相談をしたら、技術の話をかみ砕いて説明してくれた",
      true,
      "impl",
      20,
    ),
    v(
      "v2",
      "mock-b",
      "bridge",
      "分かりやすく伝えてくれる",
      "発表の前に、みんなの意見を整理してまとめてくれた",
      true,
      "focus",
      18,
    ),
    v(
      "v3",
      "mock-a",
      "impl",
      "手を動かすのが速い",
      "話したアイデアを、その日のうちに動く形にしてくれた",
      true,
      "impl",
      16,
    ),
    v(
      "v4",
      "mock-c",
      "warm",
      "話しやすい",
      "初対面なのに、緊張せずに話せた",
      false,
      null,
      2,
    ),
  ];
  return x;
}
