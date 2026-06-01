/**
 * Page object for billing pages (/billing/*).
 */
import { Page, expect } from "@playwright/test";

export class BillingPage {
  constructor(private readonly page: Page) {}

  async gotoServiceTiers(): Promise<void> {
    await this.page.goto("/#/billing/service-tiers");
  }

  async gotoBillableItemTypes(): Promise<void> {
    await this.page.goto("/#/billing/billable-item-types");
  }

  async gotoRecords(): Promise<void> {
    await this.page.goto("/#/billing/records");
  }

  async create(name: string): Promise<void> {
    await this.page.getByRole("button", { name: /new|create|add/i }).click();
    await this.page.getByLabel(/name/i).fill(name);
    await this.page.getByRole("button", { name: /save|create|confirm/i }).click();
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async expectInList(name: string): Promise<void> {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }
}
