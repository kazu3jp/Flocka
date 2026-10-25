import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClientError } from "@flocka/api-client";
import type { Profile } from "@flocka/domain";
import { createAuthRuntime } from "./helpers/auth-runtime";

type Runtime = Awaited<ReturnType<typeof createAuthRuntime>>;
type Player = Awaited<ReturnType<Runtime["register"]>>;

const links = [
  { platform: "x", value: "flocka_app" },
  { platform: "github", value: "kazu3jp" },
] as const;

async function connect(owner: Player, guest: Player): Promise<string> {
  const invite = await owner.api.createInvite();
  const exchange = await guest.api.startExchange(invite.code);
  await owner.api.approveExchange(exchange.id, "交流会", "同じ机");
  await guest.api.approveExchange(exchange.id, "交流会", "同じ机");
  return exchange.id;
}
const peerLinks = async (viewer: Player, peerId: string) =>
  (await viewer.api.getSnapshot()).peers.find((peer) => peer.id === peerId)
    ?.profile.snsLinks;

test("SNS links reach only the owner and accepted, unblocked exchange partners", async () => {
  const f = await createAuthRuntime();
  try {
    const owner = await f.register("見せる人"),
      partner = await f.register("交換相手"),
      stranger = await f.register("保留の相手"),
      scanner = await f.register("読み取るだけ");
    assert.deepEqual(owner.player.profile.snsLinks, []);
    const saved = await owner.api.updateProfile(
      { ...owner.player.profile, snsLinks: [...links] },
      ["impl", "focus"],
    );
    assert.deepEqual(saved.profile.snsLinks, links);
    assert.deepEqual((await owner.api.getMe()).profile.snsLinks, links);
    assert.deepEqual(
      (await owner.api.getSnapshot()).player.profile.snsLinks,
      links,
    );

    // A QR preview and a pending exchange are not an exchange: no links.
    const invite = await owner.api.createInvite();
    assert.deepEqual(
      (await scanner.api.previewInvite(invite.code)).profile.snsLinks,
      [],
    );
    const pending = await stranger.api.startExchange(invite.code);
    assert.equal(pending.status, "pending");
    assert.deepEqual(pending.peer.profile.snsLinks, []);
    assert.deepEqual(await peerLinks(stranger, owner.player.id), []);
    assert.deepEqual(
      (await stranger.api.getExchange(pending.id)).peer.profile.snsLinks,
      [],
    );
    assert.deepEqual(
      (await owner.api.getInviteStatus(invite.code)).exchange?.peer.profile
        .snsLinks,
      [],
    );
    // Half-approved is still pending.
    await owner.api.approveExchange(pending.id, "交流会", "同じ机");
    assert.deepEqual(await peerLinks(stranger, owner.player.id), []);
    await stranger.api.cancelExchange(pending.id);

    const exchangeId = await connect(owner, partner);
    const view = await partner.api.getExchange(exchangeId);
    assert.equal(view.status, "accepted");
    assert.deepEqual(view.peer.profile.snsLinks, links);
    assert.deepEqual(
      (await partner.api.getExchanges()).items[0].peer.profile.snsLinks,
      links,
    );
    assert.deepEqual(await peerLinks(partner, owner.player.id), links);
    // The partner's own profile (no links) stays empty for the owner.
    assert.deepEqual(await peerLinks(owner, partner.player.id), []);

    // An update from an app version without the field keeps the links.
    await owner.api.updateProfile(
      {
        ...owner.player.profile,
        role: "更新",
        snsLinks: undefined,
      } as unknown as Profile,
      ["impl", "focus"],
    );
    assert.deepEqual(await peerLinks(partner, owner.player.id), links);
    // An explicit empty list removes them for everyone.
    await owner.api.updateProfile({ ...owner.player.profile, snsLinks: [] }, [
      "impl",
      "focus",
    ]);
    assert.deepEqual(await peerLinks(partner, owner.player.id), []);
    await owner.api.updateProfile(
      { ...owner.player.profile, snsLinks: [...links] },
      ["impl", "focus"],
    );

    // Blocks hide the profile; the blocker's own list keeps a name but no links.
    await partner.api.block(owner.player.id);
    assert.deepEqual(await peerLinks(partner, owner.player.id), []);
    await partner.api.unblock(owner.player.id);
    assert.deepEqual(await peerLinks(partner, owner.player.id), links);
    await owner.api.block(partner.player.id);
    assert.equal(await peerLinks(partner, owner.player.id), undefined);
    assert.deepEqual(await peerLinks(owner, partner.player.id), []);
    await owner.api.unblock(partner.player.id);

    // Removing the connection returns no links, now or later.
    const removed = await partner.api.cancelExchange(exchangeId);
    assert.deepEqual(removed.peer.profile.snsLinks, []);
    assert.equal(await peerLinks(partner, owner.player.id), undefined);
  } finally {
    await f.runtime.dispose();
  }
});

test("the server rejects links that are not a valid handle for the platform", async () => {
  const f = await createAuthRuntime();
  try {
    const owner = await f.register("入力検証");
    await owner.api.updateProfile(
      { ...owner.player.profile, snsLinks: [...links] },
      ["impl", "focus"],
    );
    const rejected = (error: unknown) =>
      error instanceof ApiClientError && error.status === 422;
    const attempt = (snsLinks: unknown) =>
      owner.api.updateProfile(
        { ...owner.player.profile, snsLinks } as unknown as Profile,
        ["impl", "focus"],
      );
    for (const bad of [
      [{ platform: "x", value: "javascript:alert(1)" }],
      [{ platform: "x", value: "https://evil.example/a" }],
      [{ platform: "x", value: "@flocka_app" }],
      [{ platform: "mastodon", value: "flocka" }],
      [{ platform: "x", value: "a", extra: "https://evil.example" }],
      [
        { platform: "x", value: "abc" },
        { platform: "x", value: "def" },
      ],
      "https://x.com/flocka_app",
    ])
      await assert.rejects(attempt(bad), rejected, JSON.stringify(bad));
    await assert.rejects(
      owner.api.createAccount(
        {
          ...owner.player.profile,
          snsLinks: [{ platform: "x", value: "javascript:1" }],
        } as Profile,
        ["impl", "focus"],
      ),
      (error) => error instanceof ApiClientError && error.status >= 400,
    );
    // Rejected writes changed nothing.
    assert.deepEqual((await owner.api.getMe()).profile.snsLinks, links);
  } finally {
    await f.runtime.dispose();
  }
});
