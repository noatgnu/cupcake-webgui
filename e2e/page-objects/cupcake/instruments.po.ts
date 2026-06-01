/**
 * Page object for instruments (/instruments).
 */
import { Page, expect } from "@playwright/test";

export class InstrumentsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/#/instruments");
  }

  async create(name: string): Promise<void> {
    await this.page.getByRole("button", { name: /new|create|add instrument/i }).click();
    await this.page.getByLabel(/name/i).fill(name);
    await this.page.getByRole("button", { name: /save|create|confirm/i }).click();
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async open(name: string): Promise<void> {
    await this.page.getByText(name).first().click();
    await expect(this.page).toHaveURL(/\/instruments\/\d+/, { timeout: 10000 });
  }

  async addMaintenanceLog(description: string): Promise<void> {
    await this.page.getByRole("tab", { name: /maintenance/i }).click();
    await this.page.getByRole("button", { name: /add log|add first log/i }).click();
    await this.page.locator("#maintenanceDescription").fill(description);
    await this.page.locator(".modal-footer .btn-primary").click();
    await expect(this.page.getByText(description)).toBeVisible({ timeout: 10000 });
  }

  async expectInList(name: string): Promise<void> {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }
}
