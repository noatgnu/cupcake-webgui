import * as path from "path";
import { test, expect } from "../fixtures/auth";
import { StoragePage } from "../page-objects/cupcake/storage.po";

const adminAuthState = path.join(__dirname, "../auth-states/admin.json");

const FREEZER_NAME = `E2E Freezer ${Date.now()}`;
const REAGENT_NAME = `E2E Antibody ${Date.now()}`;

test.describe("storage", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: adminAuthState });
    const page = await ctx.newPage();
    const storage = new StoragePage(page);
    await storage.goto();
    await storage.create(FREEZER_NAME);
    await page.context().close();
  });

  test("storage list loads", async ({ adminPage }) => {
    const storage = new StoragePage(adminPage);
    await storage.goto();
    await expect(adminPage).toHaveURL(/\/storage/, { timeout: 10000 });
  });

  test("created freezer appears in list", async ({ adminPage }) => {
    const storage = new StoragePage(adminPage);
    await storage.goto();
    await expect(adminPage.getByText(FREEZER_NAME)).toBeVisible({ timeout: 10000 });
  });

  test("open freezer shows detail", async ({ adminPage }) => {
    const storage = new StoragePage(adminPage);
    await storage.goto();
    await storage.open(FREEZER_NAME);
    await expect(adminPage).toHaveURL(/\/storage\/\d+/, { timeout: 10000 });
  });

  test("add reagent to freezer", async ({ adminPage }) => {
    const storage = new StoragePage(adminPage);
    await storage.goto();
    await storage.open(FREEZER_NAME);
    await storage.addReagent(REAGENT_NAME, 100, "uL");
    await storage.expectReagentVisible(REAGENT_NAME);
  });

  test("update reagent quantity", async ({ adminPage }) => {
    const storage = new StoragePage(adminPage);
    await storage.goto();
    await storage.open(FREEZER_NAME);
    await storage.addReagent(REAGENT_NAME, 100, "uL");

    const reagentRow = adminPage.locator("tr, [role='row']").filter({ hasText: REAGENT_NAME }).first();
    const editBtn = reagentRow.getByRole("button", { name: /edit|update/i });
    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      const qtyInput = adminPage.getByLabel(/quantity/i);
      if (await qtyInput.isVisible({ timeout: 3000 })) {
        await qtyInput.clear();
        await qtyInput.fill("90");
        await adminPage.getByRole("button", { name: /save|confirm/i }).click();
        await expect(adminPage.getByText("90")).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test.describe("nested storage objects", () => {
    const PARENT_NAME = `E2E Parent Freezer ${Date.now()}`;
    const CHILD_NAME = `E2E Shelf ${Date.now()}`;

    test("create child storage inside a freezer and navigate via breadcrumb", async ({ adminPage }) => {
      const storage = new StoragePage(adminPage);
      await storage.goto();
      await storage.create(PARENT_NAME);
      await storage.open(PARENT_NAME);
      await expect(adminPage).toHaveURL(/\/storage\/\d+/, { timeout: 10000 });

      await storage.createChildStorage(CHILD_NAME);

      await adminPage.locator(".storage-panel-left").getByText(CHILD_NAME).click();
      await expect(adminPage.locator("nav[aria-label='breadcrumb']")).toContainText(PARENT_NAME, { timeout: 10000 });
    });
  });

  test.describe("stored reagent quantity actions", () => {
    const ACTION_FREEZER_NAME = `E2E Action Freezer ${Date.now()}`;
    const ACTION_REAGENT_NAME = `E2E Action Reagent ${Date.now()}`;

    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: adminAuthState });
      const page = await ctx.newPage();
      const storage = new StoragePage(page);
      await storage.goto();
      await storage.create(ACTION_FREEZER_NAME);
      await storage.open(ACTION_FREEZER_NAME);
      await storage.addReagent(ACTION_REAGENT_NAME, 100, "uL");
      await page.context().close();
    });

    test("add quantity increases current quantity", async ({ adminPage }) => {
      const storage = new StoragePage(adminPage);
      await storage.goto();
      await storage.open(ACTION_FREEZER_NAME);
      await storage.addQuantity(ACTION_REAGENT_NAME, 20);
      const rowText = await storage.getReagentRowText(ACTION_REAGENT_NAME);
      expect(rowText).toContain("Current: 120");
    });

    test("reserve quantity decreases current quantity", async ({ adminPage }) => {
      const storage = new StoragePage(adminPage);
      await storage.goto();
      await storage.open(ACTION_FREEZER_NAME);
      await storage.reserveQuantity(ACTION_REAGENT_NAME, 30);
      const rowText = await storage.getReagentRowText(ACTION_REAGENT_NAME);
      expect(rowText).toContain("Current: 90");
    });
  });

  test.describe("reagent search", () => {
    const SEARCH_FREEZER_NAME = `E2E Search Freezer ${Date.now()}`;
    const FINDABLE_REAGENT_NAME = `E2E Findable ${Date.now()}`;
    const OTHER_REAGENT_NAME = `E2E Other ${Date.now()}`;

    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: adminAuthState });
      const page = await ctx.newPage();
      const storage = new StoragePage(page);
      await storage.goto();
      await storage.create(SEARCH_FREEZER_NAME);
      await storage.open(SEARCH_FREEZER_NAME);
      await storage.addReagent(FINDABLE_REAGENT_NAME, 10, "mg");
      await storage.addReagent(OTHER_REAGENT_NAME, 10, "mg");
      await page.context().close();
    });

    test("searching filters the reagent list", async ({ adminPage }) => {
      const storage = new StoragePage(adminPage);
      await storage.goto();
      await storage.open(SEARCH_FREEZER_NAME);
      await storage.expectReagentVisible(FINDABLE_REAGENT_NAME);
      await storage.expectReagentVisible(OTHER_REAGENT_NAME);

      await storage.searchReagents(FINDABLE_REAGENT_NAME);
      await expect(adminPage.getByText(FINDABLE_REAGENT_NAME)).toBeVisible({ timeout: 10000 });
      await expect(adminPage.getByText(OTHER_REAGENT_NAME)).not.toBeVisible({ timeout: 5000 });
    });
  });
});
