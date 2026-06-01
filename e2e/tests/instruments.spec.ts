import { test, expect } from "../fixtures/auth";
import { InstrumentsPage } from "../page-objects/cupcake/instruments.po";

const INSTRUMENT_NAME = `E2E Mass Spec ${Date.now()}`;

test.describe("instruments", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: require("path").join(__dirname, "../auth-states/admin.json") });
    const page = await ctx.newPage();
    const instruments = new InstrumentsPage(page);
    await instruments.goto();
    await instruments.create(INSTRUMENT_NAME);
    await page.context().close();
  });

  test("instrument list loads", async ({ adminPage }) => {
    const instruments = new InstrumentsPage(adminPage);
    await instruments.goto();
    await expect(adminPage).toHaveURL(/\/instruments/, { timeout: 10000 });
  });

  test("created instrument appears in list", async ({ adminPage }) => {
    const instruments = new InstrumentsPage(adminPage);
    await instruments.goto();
    await instruments.expectInList(INSTRUMENT_NAME);
  });

  test("open instrument shows detail page", async ({ adminPage }) => {
    const instruments = new InstrumentsPage(adminPage);
    await instruments.goto();
    await instruments.open(INSTRUMENT_NAME);
    await expect(adminPage).toHaveURL(/\/instruments\/\d+/, { timeout: 10000 });
  });

  test("add maintenance log entry to instrument", async ({ adminPage }) => {
    const instruments = new InstrumentsPage(adminPage);
    await instruments.goto();
    await instruments.open(INSTRUMENT_NAME);
    await instruments.addMaintenanceLog("Annual calibration E2E");
  });
});
