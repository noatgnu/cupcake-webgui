import { test, expect } from "../fixtures/auth";
import { StoragePage } from "../page-objects/cupcake/storage.po";

const FREEZER_NAME = `E2E Freezer ${Date.now()}`;
const REAGENT_NAME = `E2E Antibody ${Date.now()}`;

test.describe("storage", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: require("path").join(__dirname, "../auth-states/admin.json") });
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
});
