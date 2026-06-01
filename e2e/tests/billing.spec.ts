import { test, expect } from "../fixtures/auth";
import { BillingPage } from "../page-objects/cupcake/billing.po";

const TIER_NAME = `E2E Tier ${Date.now()}`;

test.describe("billing", () => {
  test("service tiers page loads", async ({ adminPage }) => {
    const billing = new BillingPage(adminPage);
    await billing.gotoServiceTiers();
    await expect(adminPage).toHaveURL(/\/billing\/service-tiers|\/billing/, { timeout: 10000 });
  });

  test("create new service tier appears in list", async ({ adminPage }) => {
    const billing = new BillingPage(adminPage);
    await billing.gotoServiceTiers();
    await billing.create(TIER_NAME);
    await billing.expectInList(TIER_NAME);
  });

  test("billable item types page loads", async ({ adminPage }) => {
    const billing = new BillingPage(adminPage);
    await billing.gotoBillableItemTypes();
    await expect(adminPage).toHaveURL(/\/billing\/billable-item-types|\/billing/, { timeout: 10000 });
  });

  test("billing records page loads", async ({ adminPage }) => {
    const billing = new BillingPage(adminPage);
    await billing.gotoRecords();
    await expect(adminPage).toHaveURL(/\/billing\/records|\/billing/, { timeout: 10000 });
  });
});
