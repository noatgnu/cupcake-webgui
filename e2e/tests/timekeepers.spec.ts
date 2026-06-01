import { test, expect } from "../fixtures/auth";

test.describe("timekeepers", () => {
  test("timers panel loads", async ({ adminPage }) => {
    await adminPage.goto("/#/protocols/timers");
    await expect(adminPage).toHaveURL(/\/protocols\/timers/, { timeout: 10000 });
  });

  test("create standalone timer appears in list", async ({ adminPage }) => {
    const timerName = `E2E Timer ${Date.now()}`;
    await adminPage.goto("/#/protocols/timers");
    await adminPage.getByRole("button", { name: /new timer/i }).click();
    await adminPage.locator("#timerName").fill(timerName);
    await adminPage.locator("#timerDuration").fill("600");
    await adminPage.locator(".modal-footer .btn-primary").click();
    await expect(adminPage.getByText(timerName)).toBeVisible({ timeout: 10000 });
  });

  test("start timer shows active state", async ({ adminPage }) => {
    const timerName = `E2E Start Timer ${Date.now()}`;
    await adminPage.goto("/#/protocols/timers");
    await adminPage.getByRole("button", { name: /new timer/i }).click();
    await adminPage.locator("#timerName").fill(timerName);
    await adminPage.locator("#timerDuration").fill("300");
    await adminPage.locator(".modal-footer .btn-primary").click();
    await expect(adminPage.getByText(timerName)).toBeVisible({ timeout: 10000 });
    await adminPage.locator(".timer-list-item").filter({ hasText: timerName }).click();
    await adminPage.getByTitle("Start").click();
    await expect(adminPage.getByTitle("Pause")).toBeVisible({ timeout: 5000 });
  });
});
