import { test, expect } from "../fixtures/auth";

test.describe("notifications", () => {
  test("notifications panel loads", async ({ adminPage }) => {
    await adminPage.goto("/#/home/notifications");
    await expect(adminPage).toHaveURL(/\/home\/notifications|\/notifications/, { timeout: 10000 });
  });

  test("notification bell is visible in navbar", async ({ adminPage }) => {
    await adminPage.goto("/#/home");
    const bellBtn = adminPage.locator("app-notification-dropdown button");
    await expect(bellBtn).toBeVisible({ timeout: 10000 });
  });

  test("clicking notification bell opens panel", async ({ adminPage }) => {
    await adminPage.goto("/#/home");
    await adminPage.locator("app-notification-dropdown button").click();
    await expect(adminPage.locator("app-notification-dropdown .dropdown-menu")).toBeVisible({ timeout: 5000 });
  });

  test("notification panel shows connected state", async ({ adminPage }) => {
    await adminPage.goto("/#/home");
    await adminPage.locator("app-notification-dropdown button").click();
    await expect(adminPage.locator("app-notification-dropdown .dropdown-menu")).toBeVisible({ timeout: 5000 });
    await expect(
      adminPage.getByText(/real-time notifications are disconnected/i)
    ).not.toBeVisible({ timeout: 5000 });
  });
});
