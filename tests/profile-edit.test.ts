import assert from "node:assert/strict";
import { test } from "node:test";
import { sameProfileEdit } from "../apps/mobile/src/features/profile/profile-edit";

const profile = {
  name: "カエデ",
  role: "企画",
  interests: ["AI"],
  avatar: { type: "initial" as const, color: "yellow", motif: "" },
  links: { github: "" },
  snsLinks: [],
};

test("an untouched or only space-padded profile has nothing to discard", () => {
  const saved = { profile, self: ["plan", "lead"] };
  assert.equal(sameProfileEdit(saved, { ...saved }), true);
  assert.equal(
    sameProfileEdit(saved, {
      profile: { ...profile, name: " カエデ ", role: "企画 " },
      self: ["plan", "lead"],
    }),
    true,
  );
});

test("a changed name, card choice or link is an unsaved edit", () => {
  const saved = { profile, self: ["plan", "lead"] };
  assert.equal(
    sameProfileEdit(saved, {
      profile: { ...profile, name: "楓" },
      self: saved.self,
    }),
    false,
  );
  assert.equal(sameProfileEdit(saved, { profile, self: ["plan"] }), false);
  assert.equal(
    sameProfileEdit(saved, {
      profile: {
        ...profile,
        snsLinks: [{ platform: "github" as const, value: "kaede" }],
      },
      self: saved.self,
    }),
    false,
  );
});
