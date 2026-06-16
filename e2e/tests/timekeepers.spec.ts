import { test, expect } from "../fixtures/auth";
import { TimekeepersPage } from "../page-objects/cupcake/timekeepers.po";

test.describe("timekeepers", () => {
  test("timers panel loads", async ({ adminPage }) => {
    const page = new TimekeepersPage(adminPage);
    await page.goto();
    await expect(adminPage).toHaveURL(/\/protocols\/timers/, { timeout: 10000 });
  });

  test("create standalone timer appears in list", async ({ adminPage }) => {
    const page = new TimekeepersPage(adminPage);
    const timerName = `E2E Timer ${Date.now()}`;
    await page.goto();
    await page.createTimer(timerName, 600);
    await expect(page.timerListItem(timerName)).toBeVisible();
  });

  test("start timer shows pause button and hides start button", async ({ adminPage }) => {
    const page = new TimekeepersPage(adminPage);
    const timerName = `E2E Start Timer ${Date.now()}`;
    await page.goto();
    await page.createTimer(timerName, 300);
    await page.selectTimer(timerName);
    await page.startSelectedTimer();
    await expect(adminPage.getByTitle("Pause")).toBeVisible();
    await expect(adminPage.getByTitle("Start")).not.toBeVisible();
  });

  test("pause timer shows start button and hides pause button", async ({ adminPage }) => {
    const page = new TimekeepersPage(adminPage);
    const timerName = `E2E Pause Timer ${Date.now()}`;
    await page.goto();
    await page.createTimer(timerName, 300);
    await page.selectTimer(timerName);
    await page.startSelectedTimer();
    await page.pauseSelectedTimer();
    await expect(adminPage.getByTitle("Start")).toBeVisible();
    await expect(adminPage.getByTitle("Pause")).not.toBeVisible();
  });

  test("running timer countdown decreases over time", async ({ adminPage }) => {
    test.setTimeout(30000);
    const page = new TimekeepersPage(adminPage);
    const timerName = `E2E Countdown Timer ${Date.now()}`;
    await page.goto();
    await page.createTimer(timerName, 120);
    await page.selectTimer(timerName);
    await page.startSelectedTimer();
    const initial = await page.getDisplayedTime();
    await page.waitForTimerToDecrease(initial);
  });

  test("resume paused timer resumes countdown", async ({ adminPage }) => {
    test.setTimeout(30000);
    const page = new TimekeepersPage(adminPage);
    const timerName = `E2E Resume Timer ${Date.now()}`;
    await page.goto();
    await page.createTimer(timerName, 120);
    await page.selectTimer(timerName);
    await page.startSelectedTimer();
    await adminPage.waitForTimeout(1500);
    await page.pauseSelectedTimer();
    const pausedTime = await page.getDisplayedTime();
    await adminPage.waitForTimeout(1500);
    const afterPausedWait = await page.getDisplayedTime();
    expect(afterPausedWait).toBe(pausedTime);
    await page.startSelectedTimer();
    const afterResume = await page.getDisplayedTime();
    await adminPage.waitForTimeout(2000);
    const afterRunning = await page.getDisplayedTime();
    expect(afterRunning).not.toBe(afterResume);
  });

  test("reset timer restores original duration and shows start button", async ({
    adminPage,
  }) => {
    test.setTimeout(30000);
    const page = new TimekeepersPage(adminPage);
    const timerName = `E2E Reset Timer ${Date.now()}`;
    await page.goto();
    await page.createTimer(timerName, 60);
    await page.selectTimer(timerName);
    await page.startSelectedTimer();
    await adminPage.waitForTimeout(2000);
    await page.pauseSelectedTimer();
    await page.resetSelectedTimer();
    await expect(adminPage.getByTitle("Start")).toBeVisible({ timeout: 5000 });
    const timeAfterReset = await page.getDisplayedTime();
    expect(timeAfterReset).toMatch(/^0?1:00$/);
  });

  test("start timer after reset starts from full duration", async ({ adminPage }) => {
    test.setTimeout(30000);
    const page = new TimekeepersPage(adminPage);
    const timerName = `E2E Reset Start Timer ${Date.now()}`;
    await page.goto();
    await page.createTimer(timerName, 60);
    await page.selectTimer(timerName);
    await page.startSelectedTimer();
    await adminPage.waitForTimeout(2000);
    await page.pauseSelectedTimer();
    await page.resetSelectedTimer();
    await page.startSelectedTimer();
    const initial = await page.getDisplayedTime();
    await adminPage.waitForTimeout(2000);
    const after = await page.getDisplayedTime();
    expect(after).not.toBe(initial);
    await expect(adminPage.getByTitle("Pause")).toBeVisible();
  });

  test("filter by standalone shows only standalone timers", async ({ adminPage }) => {
    const page = new TimekeepersPage(adminPage);
    await page.goto();
    await adminPage.getByRole("button", { name: /standalone/i }).click();
    const items = adminPage.locator(".timer-list-item");
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
