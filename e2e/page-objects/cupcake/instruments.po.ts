/**
 * Page object for instruments (/instruments).
 */
import { Page, expect } from "@playwright/test";
import { fillReliably } from "./utils";

export class InstrumentsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/#/instruments");
  }

  async create(name: string): Promise<void> {
    await this.page.getByRole("button", { name: "New Instrument" }).click();
    await this.page.locator(".modal-title").waitFor();
    await fillReliably(this.page.locator("#instrumentName"), name);
    const postWait = this.page.waitForResponse(resp => resp.url().includes("/instruments/") && resp.request().method() === "POST", { timeout: 30000 });
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/instruments/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await postWait;
    await refreshWait;
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async open(name: string): Promise<void> {
    await this.page.getByText(name).first().click();
    await expect(this.page).toHaveURL(/\/instruments\/\d+/, { timeout: 10000 });
  }

  async addMaintenanceLog(description: string): Promise<void> {
    await this.page.getByRole("tab", { name: /maintenance/i }).click();
    await this.page.locator("button.btn-sm.btn-primary", { hasText: /add log/i }).click();
    await this.page.locator(".modal-title").waitFor();
    const today = new Date().toISOString().split("T")[0];
    await fillReliably(this.page.locator("#maintenanceDate"), today);
    await this.page.locator("#maintenanceDescription").fill(description);
    await this.page.locator(".modal-footer .btn-primary").click();
    await expect(this.page.locator(".modal-footer .btn-primary")).not.toBeVisible({ timeout: 10000 });
  }

  async expectInList(name: string): Promise<void> {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async editNotificationThresholds(warrantyDays: number, maintenanceDays: number): Promise<void> {
    await this.page.getByTitle("Edit Instrument").click();
    await expect(this.page.locator(".modal-title")).toContainText("Edit Instrument");
    await this.page.locator("#daysBeforeWarrantyNotification").fill(String(warrantyDays));
    await this.page.locator("#daysBeforeMaintenanceNotification").fill(String(maintenanceDays));
    const putWait = this.page.waitForResponse(resp => /\/instruments\/\d+\/$/.test(resp.url()) && resp.request().method() === "PUT", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await putWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async getNotificationThresholds(): Promise<{ warrantyDays: string; maintenanceDays: string }> {
    await this.page.getByTitle("Edit Instrument").click();
    await expect(this.page.locator(".modal-title")).toContainText("Edit Instrument");
    const warrantyDays = await this.page.locator("#daysBeforeWarrantyNotification").inputValue();
    const maintenanceDays = await this.page.locator("#daysBeforeMaintenanceNotification").inputValue();
    await this.page.getByRole("button", { name: "Cancel" }).click();
    return { warrantyDays, maintenanceDays };
  }

  async goToBookingsTab(): Promise<void> {
    await this.page.getByRole("tab", { name: /bookings/i }).click();
  }

  bookingRow(description: string) {
    return this.page.locator("table tbody tr").filter({ hasText: description });
  }

  async createBooking(description: string): Promise<void> {
    await this.page.getByRole("button", { name: "New Booking" }).click();
    await expect(this.page.locator(".modal-title")).toContainText("Create Instrument Booking");
    await this.page.locator("#description").fill(description);
    const postWait = this.page.waitForResponse(resp => resp.url().includes("/instrument-usage/") && resp.request().method() === "POST", { timeout: 30000 });
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/instrument-usage/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await postWait;
    await refreshWait;
    await expect(this.bookingRow(description)).toBeVisible({ timeout: 10000 });
  }

  async approveBooking(description: string): Promise<void> {
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/instrument-usage/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.bookingRow(description).getByTitle("Approve").click();
    await refreshWait;
  }

  async unapproveBooking(description: string): Promise<void> {
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/instrument-usage/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.bookingRow(description).getByTitle("Unapprove").click();
    await refreshWait;
  }

  async deleteBooking(description: string): Promise<void> {
    this.page.once("dialog", dialog => dialog.accept());
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/instrument-usage/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.bookingRow(description).getByTitle("Delete").click();
    await refreshWait;
  }

  async expectBookingStatus(description: string, status: "Approved" | "Pending"): Promise<void> {
    await expect(this.bookingRow(description).getByText(status, { exact: true })).toBeVisible({ timeout: 10000 });
  }

  async openPermissionsModal(): Promise<void> {
    await this.page.getByTitle("Manage Permissions").click();
    await expect(this.page.locator(".modal-title")).toContainText("Manage Permissions");
  }

  async setUserPermission(username: string, perms: { canView?: boolean; canBook?: boolean; canManage?: boolean }): Promise<void> {
    await this.page.getByPlaceholder("Search users by name, username, or email...").fill(username);
    const row = this.page.locator("table tbody tr").filter({ hasText: username });
    await expect(row).toBeVisible({ timeout: 10000 });
    const checkboxes = row.locator('input[type="checkbox"]');
    if (perms.canView !== undefined) await checkboxes.nth(0).setChecked(perms.canView);
    if (perms.canBook !== undefined) await checkboxes.nth(1).setChecked(perms.canBook);
    if (perms.canManage !== undefined) await checkboxes.nth(2).setChecked(perms.canManage);
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Save Permissions" }).click();
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async getUserPermissionCheckboxes(username: string): Promise<boolean[]> {
    await this.page.getByPlaceholder("Search users by name, username, or email...").fill(username);
    const row = this.page.locator("table tbody tr").filter({ hasText: username });
    await expect(row).toBeVisible({ timeout: 10000 });
    const checkboxes = row.locator('input[type="checkbox"]');
    return [
      await checkboxes.nth(0).isChecked(),
      await checkboxes.nth(1).isChecked(),
      await checkboxes.nth(2).isChecked(),
    ];
  }
}
