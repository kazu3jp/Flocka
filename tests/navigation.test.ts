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
