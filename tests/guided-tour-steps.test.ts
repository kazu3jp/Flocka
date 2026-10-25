import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TOUR_SEEN_KEY,
  TOUR_STEPS,
  TOUR_TARGETS,
  isLastStep,
  parseTourSeen,
  shouldShowFirstLaunchTour,
  stepAfter,
  stepAfterMissing,
  stepAnnouncement,
  type TourSeenState,
} from "../apps/mobile/src/features/guided-tour/tour-steps";

const ready = {
  seen: "unseen" as TourSeenState,
  signedIn: true,
  accountReady: true,
  onboarded: true,
  onboardingScreen: false,
};

test("the tour opens once the signed-in account is ready, onboarded and unseen", () => {
  assert.equal(shouldShowFirstLaunchTour(ready), true);
});

test("each missing condition keeps the tour away", () => {
  const changes: Partial<typeof ready>[] = [
    { seen: "seen" },
    { seen: "unknown" },
    { signedIn: false },
    { accountReady: false },
    { onboarded: false },
    { onboardingScreen: true },
  ];
  for (const change of changes)
    assert.equal(
      shouldShowFirstLaunchTour({ ...ready, ...change }),
      false,
      JSON.stringify(change),
    );
});

test("only the value this module writes counts as seen", () => {
  assert.equal(parseTourSeen("1"), true);
  for (const raw of [null, "", "0", "true", "{}"])
    assert.equal(parseTourSeen(raw), false);
});

test("the persistence key is per install, versioned and kept from the old tutorial", () => {
  assert.match(TOUR_SEEN_KEY, /^flocka-expo-tutorial-v\d+$/);
  assert.equal(TOUR_SEEN_KEY, "flocka-expo-tutorial-v1");
});

test("steps are unique, fully written and each point at a known target on a tab root", () => {
  assert.ok(TOUR_STEPS.length >= 5 && TOUR_STEPS.length <= 8);
  assert.equal(
    new Set(TOUR_STEPS.map((step) => step.key)).size,
    TOUR_STEPS.length,
  );
  const targets: string[] = Object.values(TOUR_TARGETS);
  for (const step of TOUR_STEPS) {
    assert.ok(step.icon && step.title && step.lead, step.key);
    assert.ok(targets.includes(step.target), `${step.key}: ${step.target}`);
    assert.ok(["find", "exchange", "pr"].includes(step.tab), step.key);
  }
  // Each step shows its own element, so two steps never highlight the same one.
  assert.equal(
    new Set(TOUR_STEPS.map((step) => step.target)).size,
    TOUR_STEPS.length,
  );
});

test("the steps cover the features in the spec", () => {
  const text = TOUR_STEPS.map((step) => step.title + step.lead).join("");
  for (const word of ["封筒", "メモ", "交換", "自己PR", "公開範囲", "SNS"])
    assert.ok(text.includes(word), word);
});

test("stepping returns null past either end", () => {
  assert.equal(stepAfter(0, -1), null);
  assert.equal(stepAfter(0, 1), 1);
  const last = TOUR_STEPS.length - 1;
  assert.equal(stepAfter(last, 1), null);
  assert.equal(stepAfter(last, -1), last - 1);
  assert.equal(isLastStep(last), true);
  assert.equal(isLastStep(0), false);
});

test("a missing target moves on the way the person was travelling", () => {
  assert.deepEqual(stepAfterMissing(1, 1, 5), { index: 2, direction: 1 });
  assert.deepEqual(stepAfterMissing(3, -1, 5), { index: 2, direction: -1 });
});

test("a missing last step finishes the tour and a missing first step looks forward", () => {
  assert.equal(stepAfterMissing(4, 1, 5), "finish");
  assert.deepEqual(stepAfterMissing(0, -1, 5), { index: 1, direction: 1 });
  assert.equal(stepAfterMissing(0, -1, 1), "finish");
});

test("the announcement names the position out of the total", () => {
  assert.equal(stepAnnouncement(1, 7), "7枚中2枚目");
});
