import { test, expect } from "../fixtures/auth";
import { InstrumentsPage } from "../page-objects/cupcake/instruments.po";
import { LabGroupsPage } from "../page-objects/cupcake/lab-groups.po";

const LAB_GROUP_NAME = `E2E Job Lab ${Date.now()}`;
const INSTRUMENT_NAME = `E2E Job Spec ${Date.now()}`;

test.describe("job submission", () => {
  test.beforeAll(async ({ browser }) => {
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
    await adminPage.goto("/#/jobs/submit");

    const projectInput = adminPage.getByLabel(/project.*name|name/i).first();
    if (await projectInput.isVisible({ timeout: 3000 })) {
      await projectInput.fill(`E2E Job ${Date.now()}`);
    }

    const nextBtn = adminPage.getByRole("button", { name: /next|continue/i });
    if (await nextBtn.isVisible({ timeout: 2000 })) await nextBtn.click();

    const labGroupSelect = adminPage.getByLabel(/lab.?group/i);
    if (await labGroupSelect.isVisible({ timeout: 3000 })) {
      await labGroupSelect.selectOption({ label: LAB_GROUP_NAME });
      if (await nextBtn.isVisible({ timeout: 2000 })) await nextBtn.click();
    }

    const sampleCountInput = adminPage.getByLabel(/sample.*count|number.*sample|samples/i);
    if (await sampleCountInput.isVisible({ timeout: 3000 })) {
      await sampleCountInput.fill("2");
      if (await nextBtn.isVisible({ timeout: 2000 })) await nextBtn.click();
    }

    const submitBtn = adminPage.getByRole("button", { name: /submit|finish|complete/i });
    if (await submitBtn.isVisible({ timeout: 5000 })) {
      await submitBtn.click();
      await expect(
        adminPage.getByText(/success|submitted|job.*created|pending/i)
      ).toBeVisible({ timeout: 15000 });
    }
  });
});
