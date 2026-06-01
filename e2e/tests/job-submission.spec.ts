import { test, expect } from "../fixtures/auth";
import { InstrumentsPage } from "../page-objects/cupcake/instruments.po";
import { LabGroupsPage } from "../page-objects/cupcake/lab-groups.po";

const LAB_GROUP_NAME = `E2E Job Lab ${Date.now()}`;
const INSTRUMENT_NAME = `E2E Job Spec ${Date.now()}`;

test.describe("job submission", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    const ctx = await browser.newContext({ storageState: require("path").join(__dirname, "../auth-states/admin.json") });
    const page = await ctx.newPage();

    const labGroups = new LabGroupsPage(page);
    await labGroups.goto();
    await labGroups.create(LAB_GROUP_NAME);

    const instruments = new InstrumentsPage(page);
    await instruments.goto();
    await instruments.create(INSTRUMENT_NAME);

    await page.context().close();
  });

  test("job submission page loads", async ({ adminPage }) => {
    await adminPage.goto("/#/jobs/submit");
    await expect(adminPage).toHaveURL(/\/jobs\/submit/, { timeout: 10000 });
  });

  test("jobs list page loads", async ({ adminPage }) => {
    await adminPage.goto("/#/jobs");
    await expect(adminPage).toHaveURL(/\/jobs/, { timeout: 10000 });
  });

  test("basic job submission flow completes", async ({ adminPage }) => {
    test.setTimeout(120000);
    await adminPage.goto("/#/jobs/submit");
    await expect(adminPage).toHaveURL(/\/jobs\/submit/, { timeout: 10000 });

    // Step 1: Job title and project, then create draft
    await adminPage.locator("#jobTitle").fill(`E2E Job ${Date.now()}`);
    await adminPage.locator("#projectTitle").fill(`E2E Project ${Date.now()}`);
    await adminPage.getByRole("button", { name: /create draft/i }).click();

    // Step 2: Lab group (autocomplete text input)
    await expect(adminPage.locator("#labGroup")).toBeVisible({ timeout: 15000 });
    await adminPage.locator("#labGroup").fill(LAB_GROUP_NAME);
    await expect(
      adminPage.locator("div.position-absolute .list-group-item-action").filter({ hasText: LAB_GROUP_NAME })
    ).toBeVisible({ timeout: 10000 });
    await adminPage.locator("div.position-absolute .list-group-item-action").filter({ hasText: LAB_GROUP_NAME }).click();
    await adminPage.getByRole("button", { name: /save.*continue/i }).click();

    // Step 3: Sample count
    await expect(adminPage.locator("#sampleNumber")).toBeVisible({ timeout: 10000 });
    await adminPage.locator("#sampleNumber").fill("2");
    await adminPage.getByRole("button", { name: /save.*continue/i }).click();

    // Step 4: Template selection (select first available template)
    await expect(adminPage.locator("#template")).toBeVisible({ timeout: 10000 });
    await adminPage.locator("#template").selectOption({ index: 1 });
    await adminPage.getByRole("button", { name: /save.*continue/i }).click();

    // Step 5: Create metadata table then submit
    await expect(adminPage.getByRole("button", { name: /create metadata table/i })).toBeVisible({ timeout: 10000 });
    await adminPage.getByRole("button", { name: /create metadata table/i }).click();
    await expect(adminPage.getByRole("button", { name: /submit job/i })).toBeVisible({ timeout: 15000 });
    await adminPage.getByRole("button", { name: /submit job/i }).click();
    await expect(adminPage).toHaveURL(/\/jobs\/\d+|\/jobs/, { timeout: 15000 });
  });
});
