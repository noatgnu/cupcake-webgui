import { test, expect } from "../fixtures/auth";

test.describe("messages", () => {
  test("messages panel loads", async ({ adminPage }) => {
    await adminPage.goto("/#/home/messages");
    await expect(adminPage).toHaveURL(/\/home\/messages|\/messages/, { timeout: 10000 });
  });

  test("messages view shows thread list area", async ({ adminPage }) => {
    await adminPage.goto("/#/home/messages");
    await expect(adminPage.locator(".messages-view")).toBeVisible({ timeout: 10000 });
    await expect(adminPage.locator(".threads-sidebar")).toBeVisible({ timeout: 5000 });
  });

  test("messages panel loads for testuser", async ({ userPage }) => {
    await userPage.goto("/#/home/messages");
    await expect(userPage).toHaveURL(/\/home\/messages|\/messages/, { timeout: 10000 });
    await expect(userPage.locator(".messages-view")).toBeVisible({ timeout: 10000 });
  });
});
