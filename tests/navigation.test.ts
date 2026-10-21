import assert from "node:assert/strict";
import { test } from "node:test";
import { initNav, navigationForRoute, validNav } from "@flocka/domain";

test("external routes select their tab and preserve valid back history", () => {
  const initial = initNav();
  const pr = navigationForRoute(initial, { id: "pr" });
  assert.equal(pr.tab, "pr");
  assert.equal(navigationForRoute(pr, { id: "pr", params: {} }), pr);
  const card = navigationForRoute(pr, {
    id: "card",
    params: { key: "bridge" },
  });
  assert.equal(card.tab, "find");
  assert.deepEqual(card.stacks.find, [
    { id: "deck" },
    { id: "card", params: { key: "bridge" } },
  ]);
  card.stacks.find.push({ id: "give", params: { cid: "connection" } });
  assert.equal(
    navigationForRoute(card, { id: "give", params: { cid: "connection" } }),
    card,
  );
  const back = navigationForRoute(card, {
    id: "card",
    params: { key: "bridge" },
  });
  assert.equal(back.stacks.find.length, 2);
  const exchange = navigationForRoute(back, {
    id: "confirm",
    params: { cid: "incoming" },
  });
  assert.equal(exchange.tab, "exchange");
  assert.deepEqual(exchange.stacks.exchange, [
    { id: "exchange" },
    { id: "confirm", params: { cid: "incoming" } },
  ]);
  assert.deepEqual(
    navigationForRoute(exchange, { id: "exchange" }).stacks.exchange,
    [{ id: "exchange" }],
  );
  assert.equal(validNav(exchange), true);
});

test("the card collection opens on the deck tab above the deck", () => {
  const collection = navigationForRoute(initNav(), { id: "collection" });
  assert.equal(collection.tab, "find");
  assert.deepEqual(collection.stacks.find, [
    { id: "deck" },
    { id: "collection" },
  ]);
  assert.equal(validNav(collection), true);
});

test("onboarding and detail screens without their id never enter a tab stack", () => {
  const initial = initNav();
  assert.equal(navigationForRoute(initial, { id: "onboarding" }), initial);
  for (const id of ["card", "deco", "piece", "give", "confirm"] as const) {
    assert.equal(navigationForRoute(initial, { id }), initial);
    assert.equal(navigationForRoute(initial, { id, params: {} }), initial);
  }
  const withOnboarding = initNav();
  withOnboarding.stacks.find.push({ id: "onboarding" });
  assert.equal(validNav(withOnboarding), false);
  const withoutKey = initNav();
  withoutKey.stacks.find.push({ id: "card" });
  assert.equal(validNav(withoutKey), false);
  const piece = navigationForRoute(initial, {
    id: "piece",
    params: { id: "p1" },
  });
  assert.equal(validNav(piece), true);
});
