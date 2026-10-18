import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import catalog from "../packages/domain/src/catalog.json";
import vectors from "../apps/mobile/src/vectors.json";
import {
  CARDS,
  buildPR,
  derive,
  fresh,
  initNav,
  openPiece,
  optionsFor,
  restoreState,
  summarize,
  validNav,
  type Piece,
} from "../packages/domain/src";
import { sampleState } from "./helpers/sample-state";

const makePiece = (fromId: string, opened = true, card = "bridge"): Piece => ({
  id: fromId + "-" + card,
  exchangeId: "c-" + fromId,
  fromId,
  card,
  kind: "vibe",
  text: "説明が分かりやすかった",
  label: "分かりやすい",
  opened,
  guess: "impl",
  visibility: "private",
  createdAt: "2026-10-13T00:00:00Z",
});
test("fresh registration has no fake testimonies or automatic PR", () => {
  const s = fresh();
  assert.equal(s.onboarded, false);
  assert.equal(derive(s).deck.length, 0);
  assert.equal(buildPR(s), null);
});
test("two testimonies from the same person do not confirm a strength", () => {
  const s = fresh();
  s.self = ["impl", "focus"];
  s.vibes = [makePiece("mock-a"), { ...makePiece("mock-a"), id: "other" }];
  assert.equal(derive(s).cards.bridge.confirmed, false);
  assert.equal(buildPR(s), null);
  s.vibes.push(makePiece("mock-b"));
  assert.equal(derive(s).cards.bridge.confirmed, true);
});
test("a closed envelope cannot contribute to the deck or PR", () => {
  const s = fresh();
  s.vibes = [makePiece("mock-a"), makePiece("mock-b", false)];
  assert.equal(derive(s).best, 1);
  assert.equal(buildPR(s), null);
  openPiece(s, s.vibes[1].id, "bridge");
  assert.equal(derive(s).cards.bridge.confirmed, true);
  const at = s.vibes[1].guessedAt;
  openPiece(s, s.vibes[1].id, "impl");
  assert.equal(s.vibes[1].guessedAt, at);
  assert.equal(s.vibes[1].guess, "bridge");
});
test("hidden and blocked testimonies are excluded from card counts and PR", () => {
  const s = sampleState();
  assert.ok(buildPR(s));
  s.vibes[1].visibility = "hidden";
  assert.equal(buildPR(s), null);
  s.vibes[1].visibility = "private";
  s.blocked.push("mock-b");
  assert.equal(buildPR(s), null);
  assert.equal(
    derive(s).pieces.some((p) => p.fromId === "mock-b"),
    false,
  );
});
test("disagreement prevents that confirmed card from generating PR", () => {
  const s = sampleState();
  s.resp.bridge = "disagree";
  assert.equal(buildPR(s), null);
  s.resp.bridge = "hold";
  assert.ok(buildPR(s));
});
test("guess choices remain fixed, distinct, and include the actual card", () => {
  const s = sampleState();
  for (const card of Object.keys(CARDS)) {
    const p = makePiece("mock-a", false, card);
    const a = optionsFor(p, s.self);
    assert.equal(a.length, 3);
    assert.equal(new Set(a).size, 3);
    assert.ok(a.includes(card));
    assert.deepEqual(optionsFor(p, s.self), a);
  }
});
test("new discovery follows the original missed-guess rule", () => {
  const s = fresh();
  s.self = ["impl", "focus"];
  s.vibes = [makePiece("mock-a")];
  assert.equal(derive(s).cards.bridge.discovered, true);
  s.vibes[0].guess = "bridge";
  assert.equal(derive(s).cards.bridge.discovered, false);
});
test("PR uses actual quotations, omits sender names, and prefers scenes", () => {
  const s = sampleState();
  s.proofs = [
    {
      ...makePiece("mock-c"),
      id: "proof",
      kind: "proof",
      story: "登壇後、図を描いて質問に答えてくれた",
    },
  ];
  const pr = buildPR(s)!;
  assert.ok(pr.text.includes(s.proofs[0].story!));
  for (const name of ["ミナト", "ソラ", "カエデ"])
    assert.equal(pr.text.includes(name), false);
  assert.equal(
    pr.text.indexOf(s.proofs[0].story!) < pr.text.indexOf(s.vibes[0].text!),
    true,
  );
  assert.ok(pr.text.includes("（ここに、これから取り組みたいことを書こう）"));
});
test("PR never describes repeated notes from one witness as different people", () => {
  const state = sampleState();
  state.proofs = Array.from({ length: 4 }, (_, index) => ({
    ...makePiece("mock-a"),
    id: `same-witness-${index}`,
    kind: "proof" as const,
    story: `一人目の仲間からのメモ${index}`,
  }));
  const document = buildPR(state)!;
  assert.deepEqual(document.sources, ["mock-a", "mock-b"]);
  assert.equal(
    document.segments.filter((segment) => segment.kind === "quote").length,
    2,
  );
  assert.ok(document.text.includes("一人目の仲間からのメモ0"));
  assert.ok(
    document.text.includes(
      state.vibes.find((piece) => piece.fromId === "mock-b")!.text!,
    ),
  );
  assert.equal(document.text.includes("一人目の仲間からのメモ1"), false);
});

test("PR attributes a quotation to its actual exchange, never another meeting", () => {
  const state = sampleState();
  const original = state.connections[0];
  original.context.place = "証言を受け取った会場";
  state.connections.unshift({
    ...original,
    id: "later-exchange",
    context: { place: "別の会場", trigger: "再会" },
  });
  assert.ok(buildPR(state)!.text.includes("証言を受け取った会場では、"));
  assert.equal(buildPR(state)!.text.includes("別の会場"), false);
  delete state.vibes[0].exchangeId;
  assert.equal(buildPR(state)!.text.includes("証言を受け取った会場"), false);
  assert.equal(buildPR(state)!.text.includes("別の会場"), false);
});

test("native deck ranking and PR match the original HTML business logic", () => {
  const source = readFileSync(
    new URL("../design/flocka-v2-blue-prototype.html", import.meta.url),
    "utf8",
  );
  const block = source.slice(
    source.indexOf("function fresh()"),
    source.indexOf("const now ="),
  );
  const context = {
    CARDS: catalog.CARDS,
    SELF_OPTIONS: catalog.SELF_OPTIONS,
    result: null as unknown,
  };
  vm.runInNewContext(block + ";result={derive,buildPR};", context);
  const original = context.result as {
    derive: (s: unknown) => ReturnType<typeof derive>;
    buildPR: (
      s: unknown,
      d: unknown,
    ) => {
      text: string;
      segs: {
        br?: number;
        t?: string;
        m?: string;
        q?: string;
        fill?: string;
      }[];
    } | null;
  };
  for (const self of [
    ["impl", "focus"],
    ["bridge", "focus"],
  ]) {
    for (const withScene of [false, true]) {
      for (const blocked of [[], ["mock-b"], ["mock-a"]]) {
        const s = sampleState();
        s.blocked = blocked;
        s.self = self;
        if (withScene)
          s.proofs.push({
            ...makePiece("mock-c"),
            id: "pr-scene",
            kind: "proof",
            story: "登壇後、図を描いて質問に答えてくれた",
          });
        const d = derive(s),
          old = original.derive(s);
        assert.equal(
          JSON.stringify(
            d.deck.map((c) => [
              c.key,
              c.confirmed,
              c.discovered,
              c.givers.length,
            ]),
          ),
          JSON.stringify(
            old.deck.map((c) => [
              c.key,
              c.confirmed,
              c.discovered,
              c.givers.length,
            ]),
          ),
        );
        const actualPR = buildPR(s),
          referencePR = original.buildPR(s, old);
        assert.equal(actualPR?.text, referencePR?.text);
        const referenceSegments = referencePR?.segs.map((segment) => {
          if (segment.br) return { kind: "break" };
          if (segment.m) return { kind: "strength", text: segment.m };
          if (segment.q) return { kind: "quote", text: segment.q };
          if (segment.fill) return { kind: "placeholder", text: segment.fill };
          return { kind: "text", text: segment.t };
        });
        assert.equal(
          JSON.stringify(actualPR?.segments),
          JSON.stringify(referenceSegments),
        );
      }
    }
  }
});
test("storage round-trips every profile, card and testimony", () => {
  const s = sampleState();
  s.prDraft = "手で編集した下書き";
  s.deco.impl = {
    pattern: "dots",
    frame: "mint",
    stickers: ["heart"],
    color: "rose",
  };
  assert.deepEqual(restoreState(JSON.stringify(s)), s);
  assert.deepEqual(restoreState(null), fresh());
  assert.throws(() => restoreState("{broken"));
  assert.throws(() => restoreState('{"schemaVersion":2}'));
});
test("invalid restored routes are rejected, independent stacks are accepted", () => {
  const n = initNav();
  n.stacks.find.push({ id: "card", params: { key: "impl" } });
  n.stacks.exchange.push({ id: "give", params: { cid: "c-mock-a" } });
  assert.equal(validNav(JSON.parse(JSON.stringify(n))), true);
  assert.equal(
    validNav({ tab: "find", stacks: { find: [{ id: "bad" }] } }),
    false,
  );
  assert.equal(validNav({}), false);
  assert.equal(validNav(null), false);
});
test("keyword summary preserves the prototype phrases", () => {
  assert.deepEqual(
    summarize("実装のコードを書いて、動くものを作ってくれた").card,
    "impl",
  );
  assert.equal(
    summarize("説明が分かりやすく、整理して共有した").card,
    "bridge",
  );
});
test("all original drawings are bundled and all native colors are sRGB", () => {
  assert.equal(Object.keys(vectors.cards).length, 21);
  assert.equal(Object.keys(vectors.stickers).length, 12);
  assert.equal(Object.keys(vectors.motifs).length, 6);
  for (const xml of [
    ...Object.values(vectors.cards),
    ...Object.values(vectors.stickers),
    ...Object.values(vectors.motifs),
    vectors.icon,
  ]) {
    assert.ok(xml.includes("<svg"));
    assert.equal(xml.includes("oklch("), false);
    assert.equal(xml.includes("var(--"), false);
  }
  assert.equal(Object.keys(CARDS).length, 21);
  assert.match(catalog.COLORS.blue, /^#[0-9a-f]{6}$/);
});

test("incomplete registration persists, while corrupted profile values are rejected", () => {
  const s = fresh();
  assert.deepEqual(restoreState(JSON.stringify(s)), s);
  const bad = {
    ...sampleState(),
    profile: { ...sampleState().profile, role: null },
  };
  assert.throws(() => restoreState(JSON.stringify(bad)));
});
