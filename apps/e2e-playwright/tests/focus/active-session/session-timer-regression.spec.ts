import { expect, test } from "../../fixtures/e2e-test";
import { ensureInAppOnHome } from "../../utils/helpers";
import {
  addAdvancedFocusItems,
  readSessionRuntime,
  resetFocusSession,
  showFocusFullscreen,
  startAdvancedFocus
} from "../focus-test-helpers";
import { configureSessionComposition } from "./session-test-support";

test.afterEach(async ({ page }) => {
  await resetFocusSession(page).catch(() => null);
});

test("keeps a target-focus break running at an exact timer boundary", async ({
  page,
  seed
}) => {
  await ensureInAppOnHome(page);
  await resetFocusSession(page);
  const fixture = await seed.focus.resources({
    prefix: "E2E exact-boundary break"
  });
  await addAdvancedFocusItems(page, [fixture.objective.label]);
  await configureSessionComposition(page, {
    breakDuration: 0,
    breakReminder: 0,
    breakType: "Reminder",
    focusDuration: 120,
    numberOfBreaks: 0,
    totalDuration: 120,
    type: "Focus target"
  });
  const boundary = Math.ceil(Date.now() / 1000) * 1000 + 1000;
  await page.clock.install({ time: new Date(boundary - 1000) });
  await page.clock.pauseAt(new Date(boundary));
  await startAdvancedFocus(page);
  await page.clock.runFor(2000);
  await page
    .getByRole("button", { name: /^Break$/i })
    .first()
    .dispatchEvent("click");
  await expect(page.getByText("CURRENT BREAK").first()).toBeVisible();
  await page.clock.runFor(3000);
  expect((await readSessionRuntime(page)).state).toBe(3);
  await expect(page.getByText("CURRENT BREAK").first()).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await ensureInAppOnHome(page);
  await showFocusFullscreen(page);
  await expect(page.getByText("CURRENT BREAK").first()).toBeVisible();
});

test("advances predefined intervals with a controlled clock", async ({
  page,
  seed
}) => {
  await ensureInAppOnHome(page);
  await resetFocusSession(page);
  const fixture = await seed.focus.resources({ prefix: "E2E interval timer" });
  await addAdvancedFocusItems(page, [fixture.objective.label]);
  await configureSessionComposition(page, {
    breakDuration: 30,
    breakReminder: 0,
    breakType: "Predefined",
    focusDuration: 60,
    numberOfBreaks: 1,
    totalDuration: 90,
    type: "Total duration"
  });
  const boundary = Math.ceil(Date.now() / 1000) * 1000 + 1000;
  await page.clock.install({ time: new Date(boundary - 1000) });
  await page.clock.pauseAt(new Date(boundary));
  await startAdvancedFocus(page);
  await page.clock.runFor(31000);
  expect((await readSessionRuntime(page)).state).toBe(3);
  await expect(page.getByText("CURRENT BREAK").first()).toBeVisible();
  await page.clock.runFor(30000);
  expect((await readSessionRuntime(page)).state).toBe(1);
  await expect(page.getByText("CURRENT FOCUS").first()).toBeVisible();
  await page.clock.runFor(30000);
  await expect(
    page.getByRole("button", { name: /^Done/i }).first()
  ).toBeVisible();
});
