import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TUTORIAL_SEEN_KEY,
  TUTORIAL_STEPS,
  isLastStep,
  parseTutorialSeen,
  shouldShowFirstLaunchTutorial,
  stepAfter,
  type TutorialSeenState,
} from "../apps/mobile/src/features/tutorial/tutorial-steps";

const ready = {
  seen: "unseen" as TutorialSeenState,
  signedIn: true,
  accountReady: true,
  onboarded: true,
  onboardingScreen: false,
};

test("the tutorial opens once the signed-in account is ready, onboarded and unseen", () => {
  assert.equal(shouldShowFirstLaunchTutorial(ready), true);
});

test("each missing condition keeps the tutorial away", () => {
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
      shouldShowFirstLaunchTutorial({ ...ready, ...change }),
      false,
      JSON.stringify(change),
    );
});

test("only the value this module writes counts as seen", () => {
  assert.equal(parseTutorialSeen("1"), true);
  for (const raw of [null, "", "0", "true", "{}"])
    assert.equal(parseTutorialSeen(raw), false);
});

test("the persistence key is per install and versioned", () => {
  assert.match(TUTORIAL_SEEN_KEY, /^flocka-expo-tutorial-v\d+$/);
});

test("steps are short, unique and fully written", () => {
  assert.ok(TUTORIAL_STEPS.length >= 3 && TUTORIAL_STEPS.length <= 6);
  assert.equal(
    new Set(TUTORIAL_STEPS.map((step) => step.key)).size,
    TUTORIAL_STEPS.length,
  );
  for (const step of TUTORIAL_STEPS)
    assert.ok(step.icon && step.title && step.lead, step.key);
});

test("stepping stays inside the list and the last step is detected", () => {
  assert.equal(stepAfter(0, -1), 0);
  assert.equal(stepAfter(0, 1), 1);
  const last = TUTORIAL_STEPS.length - 1;
  assert.equal(stepAfter(last, 1), last);
  assert.equal(isLastStep(last), true);
  assert.equal(isLastStep(0), false);
});
