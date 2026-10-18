import assert from "node:assert/strict";
import { isIP } from "node:net";
import { test } from "node:test";
import { testClientAddress } from "./helpers/client-address";

test("fixture clients remain distinct valid IPv4 addresses past the 255th account", () => {
  const allocated = new Set<string>();
  for (let number = 1; number <= 65_535; number++) {
    const address = testClientAddress(number);
    assert.equal(isIP(address), 4);
    assert.ok(address.startsWith("198.19."));
    allocated.add(address);
  }
  assert.equal(allocated.size, 65_535);
  for (const invalid of [0, -1, 1.5, NaN, Infinity, 65_536])
    assert.throws(() => testClientAddress(invalid));
});
