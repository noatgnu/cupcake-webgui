import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects/common/login.po";
import { NavbarPage } from "../page-objects/common/navbar.po";

test.describe("authentication", () => {
  test("login as admin lands on home dashboard", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("admin", "cupcake");
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
  });

  test("invalid credentials shows error message", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("admin", "badpassword");
    await login.expectError();
  });

  test("unauthenticated visit redirects to /login", async ({ page }) => {
    await page.goto("/#/home");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("logout returns to /login", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("admin", "cupcake");
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
    const navbar = new NavbarPage(page);
    await navbar.logout();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
