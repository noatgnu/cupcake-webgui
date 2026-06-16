import * as path from "path";
import { test, expect } from "../fixtures/auth";
import { ProtocolEditorPage } from "../page-objects/cupcake/protocol-editor.po";
import { SessionDetailPage } from "../page-objects/cupcake/session-detail.po";

const PROTOCOL_TITLE = `E2E Session Protocol ${Date.now()}`;

test.describe("sessions", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180000);
    const ctx = await browser.newContext({
      storageState: path.join(__dirname, "../auth-states/admin.json"),
    });
    const page = await ctx.newPage();
    const editor = new ProtocolEditorPage(page);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await editor.addSection("Section 1");
    await editor.addStep("Section 1", "Step 1", 10);
    await page.context().close();
  });

  test("session list page loads", async ({ adminPage }) => {
    const session = new SessionDetailPage(adminPage);
    await session.gotoList();
    await expect(adminPage).toHaveURL(/\/protocols\/sessions/, { timeout: 10000 });
  });

  test("create session from protocol", async ({ adminPage }) => {
    test.setTimeout(120000);
    const session = new SessionDetailPage(adminPage);
    await session.gotoList();
    await session.createFromProtocol(PROTOCOL_TITLE);
    await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
  });

  test("session detail shows steps", async ({ adminPage }) => {
    test.setTimeout(120000);
    const session = new SessionDetailPage(adminPage);
    await session.gotoList();
    await session.createFromProtocol(PROTOCOL_TITLE);
    await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
    await expect(adminPage.getByText("Step 1").first()).toBeVisible({ timeout: 10000 });
  });

  test.describe("session step timers", () => {
    test("start timer shows pause button", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await expect(adminPage.getByTitle("Pause Timer")).toBeVisible();
      await expect(adminPage.getByTitle("Start Timer")).not.toBeVisible();
    });

    test("timer countdown decreases after start", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      const initial = await session.getStepTimerDisplay();
      await adminPage.waitForTimeout(2500);
      const after = await session.getStepTimerDisplay();
      expect(after).not.toBe(initial);
    });

    test("pause timer shows start button and stops countdown", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await adminPage.waitForTimeout(1500);
      await session.pauseStepTimer();
      const pausedValue = await session.getStepTimerDisplay();
      await adminPage.waitForTimeout(2000);
      const afterWait = await session.getStepTimerDisplay();
      expect(afterWait).toBe(pausedValue);
    });

    test("resume paused timer continues countdown", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await adminPage.waitForTimeout(1500);
      await session.pauseStepTimer();
      const pausedValue = await session.getStepTimerDisplay();
      await session.startStepTimer();
      await adminPage.waitForTimeout(2500);
      const afterResume = await session.getStepTimerDisplay();
      expect(afterResume).not.toBe(pausedValue);
    });

    test("reset timer restores full duration and shows start button", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await adminPage.waitForTimeout(2000);
      await session.pauseStepTimer();
      await session.resetStepTimer();
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 5000 });
      const resetDisplay = await session.getStepTimerDisplay();
      expect(resetDisplay).toMatch(/00:00:0[89]|00:00:10/);
    });

    test("start after reset begins countdown from full duration", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await adminPage.waitForTimeout(2000);
      await session.pauseStepTimer();
      await session.resetStepTimer();
      await session.startStepTimer();
      const initial = await session.getStepTimerDisplay();
      await adminPage.waitForTimeout(2500);
      const after = await session.getStepTimerDisplay();
      expect(after).not.toBe(initial);
      await expect(adminPage.getByTitle("Pause Timer")).toBeVisible();
    });
  });
});
