/**
 * Playwright test fixtures providing pre-authenticated pages for admin and regular users.
 */
import { test as base, Browser, Page } from "@playwright/test";
import * as path from "path";

const AUTH_STATES = {
  admin: path.join(__dirname, "../auth-states/admin.json"),
  user: path.join(__dirname, "../auth-states/user.json"),
};

async function createAuthPage(browser: Browser, stateFile: string): Promise<Page> {
  const ctx = await browser.newContext({ storageState: stateFile });
  return ctx.newPage();
}

export const test = base.extend<{ adminPage: Page; userPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const page = await createAuthPage(browser, AUTH_STATES.admin);
    await use(page);
    await page.context().close();
  },
  userPage: async ({ browser }, use) => {
    const page = await createAuthPage(browser, AUTH_STATES.user);
    await use(page);
    await page.context().close();
  },
});

export { expect } from "@playwright/test";
