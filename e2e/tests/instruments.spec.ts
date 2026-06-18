import * as path from "path";
import { test, expect } from "../fixtures/auth";
import { InstrumentsPage } from "../page-objects/cupcake/instruments.po";

const adminAuthState = path.join(__dirname, "../auth-states/admin.json");

const INSTRUMENT_NAME = `E2E Mass Spec ${Date.now()}`;

test.describe("instruments", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: adminAuthState });
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

  test.describe("notification thresholds", () => {
    const THRESHOLD_INSTRUMENT_NAME = `E2E Threshold Instrument ${Date.now()}`;

    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: adminAuthState });
      const page = await ctx.newPage();
      const instruments = new InstrumentsPage(page);
      await instruments.goto();
      await instruments.create(THRESHOLD_INSTRUMENT_NAME);
      await page.context().close();
    });

    test("editing warranty and maintenance notification days persists", async ({ adminPage }) => {
      const instruments = new InstrumentsPage(adminPage);
      await instruments.goto();
      await instruments.open(THRESHOLD_INSTRUMENT_NAME);

      await instruments.editNotificationThresholds(45, 21);

      await instruments.goto();
      await instruments.open(THRESHOLD_INSTRUMENT_NAME);
      const thresholds = await instruments.getNotificationThresholds();
      expect(thresholds.warrantyDays).toBe("45");
      expect(thresholds.maintenanceDays).toBe("21");
    });
  });

  test.describe("instrument booking", () => {
    const BOOKING_INSTRUMENT_NAME = `E2E Booking Instrument ${Date.now()}`;
    const BOOKING_DESCRIPTION = `E2E Booking ${Date.now()}`;

    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: adminAuthState });
      const page = await ctx.newPage();
      const instruments = new InstrumentsPage(page);
      await instruments.goto();
      await instruments.create(BOOKING_INSTRUMENT_NAME);
      await page.context().close();
    });

    test("create booking shows as pending, then approve and unapprove", async ({ adminPage }) => {
      const instruments = new InstrumentsPage(adminPage);
      await instruments.goto();
      await instruments.open(BOOKING_INSTRUMENT_NAME);
      await instruments.goToBookingsTab();

      await instruments.createBooking(BOOKING_DESCRIPTION);
      await instruments.expectBookingStatus(BOOKING_DESCRIPTION, "Pending");

      await instruments.approveBooking(BOOKING_DESCRIPTION);
      await instruments.expectBookingStatus(BOOKING_DESCRIPTION, "Approved");

      await instruments.unapproveBooking(BOOKING_DESCRIPTION);
      await instruments.expectBookingStatus(BOOKING_DESCRIPTION, "Pending");
    });

    test("delete booking removes it from the list", async ({ adminPage }) => {
      const instruments = new InstrumentsPage(adminPage);
      await instruments.goto();
      await instruments.open(BOOKING_INSTRUMENT_NAME);
      await instruments.goToBookingsTab();

      const toDelete = `${BOOKING_DESCRIPTION} to delete`;
      await instruments.createBooking(toDelete);
      await instruments.deleteBooking(toDelete);

      await expect(instruments.bookingRow(toDelete)).not.toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("instrument permissions", () => {
    const PERMISSION_INSTRUMENT_NAME = `E2E Permission Instrument ${Date.now()}`;

    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: adminAuthState });
      const page = await ctx.newPage();
      const instruments = new InstrumentsPage(page);
      await instruments.goto();
      await instruments.create(PERMISSION_INSTRUMENT_NAME);
      await page.context().close();
    });

    test("granting book permission to a user persists", async ({ adminPage }) => {
      const instruments = new InstrumentsPage(adminPage);
      await instruments.goto();
      await instruments.open(PERMISSION_INSTRUMENT_NAME);

      await instruments.openPermissionsModal();
      await instruments.setUserPermission("testuser", { canView: true, canBook: true });

      await instruments.openPermissionsModal();
      const checkboxes = await instruments.getUserPermissionCheckboxes("testuser");
      expect(checkboxes).toEqual([true, true, false]);
    });
  });
});
