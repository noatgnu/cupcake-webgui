import * as path from "path";
import { test, expect } from "../fixtures/auth";
import { LabGroupsPage } from "../page-objects/cupcake/lab-groups.po";
import { StoragePage } from "../page-objects/cupcake/storage.po";

const adminAuthState = path.join(__dirname, "../auth-states/admin.json");

test.describe("lab group sharing", () => {
  const LAB_GROUP_NAME = `E2E Sharing Lab ${Date.now()}`;
  const FREEZER_NAME = `E2E Shared Freezer ${Date.now()}`;
  const REAGENT_NAME = `E2E Shared Reagent ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const adminCtx = await browser.newContext({ storageState: adminAuthState });
    const adminCtxPage = await adminCtx.newPage();

    const labGroups = new LabGroupsPage(adminCtxPage);
    await labGroups.goto();
    await labGroups.create(LAB_GROUP_NAME);
    await labGroups.open(LAB_GROUP_NAME);
    const invitationId = await labGroups.inviteUser("testuser");

    const storage = new StoragePage(adminCtxPage);
    await storage.goto();
    await storage.create(FREEZER_NAME);
    await storage.open(FREEZER_NAME);
    await storage.addReagent(REAGENT_NAME, 100, "mg");

    await adminCtx.close();

    // testuser accepts the invitation so they become a real lab group member.
    const userCtx = await browser.newContext({ storageState: path.join(__dirname, "../auth-states/user.json") });
    const userCtxPage = await userCtx.newPage();
    await userCtxPage.goto(`/#/lab-groups/invitations/${invitationId}/accept`);
    await userCtxPage.getByRole("button", { name: "Accept" }).click();
    await expect(userCtxPage).toHaveURL(/\/home\/lab-groups/, { timeout: 10000 });
    await userCtx.close();
  });

  test("non-shared storage object is not visible to a lab group member", async ({ userPage }) => {
    const storage = new StoragePage(userPage);
    await storage.goto();
    await expect(userPage.getByText(FREEZER_NAME)).not.toBeVisible({ timeout: 5000 });
  });

  test("sharing the storage object with the lab group makes it visible, but not the reagent inside", async ({ adminPage, userPage }) => {
    const adminStorage = new StoragePage(adminPage);
    await adminStorage.goto();
    await adminStorage.open(FREEZER_NAME);
    await adminStorage.shareStorageWithLabGroup(LAB_GROUP_NAME);

    const userStorage = new StoragePage(userPage);
    await userStorage.goto();
    await expect(userPage.getByText(FREEZER_NAME)).toBeVisible({ timeout: 10000 });

    await userStorage.open(FREEZER_NAME);
    await expect(userPage.getByText(REAGENT_NAME)).not.toBeVisible({ timeout: 5000 });
  });

  test("additionally sharing the reagent with the lab group makes it visible too", async ({ adminPage, userPage }) => {
    const adminStorage = new StoragePage(adminPage);
    await adminStorage.goto();
    await adminStorage.open(FREEZER_NAME);
    await adminStorage.shareReagentWithLabGroup(REAGENT_NAME, LAB_GROUP_NAME);

    const userStorage = new StoragePage(userPage);
    await userStorage.goto();
    await userStorage.open(FREEZER_NAME);
    await expect(userPage.getByText(REAGENT_NAME)).toBeVisible({ timeout: 10000 });
  });
});
