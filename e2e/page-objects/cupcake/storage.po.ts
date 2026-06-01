/**
 * Page object for storage management (/storage).
 */
import { Page, expect } from "@playwright/test";

export class StoragePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/#/storage");
  }

  async create(name: string): Promise<void> {
    await this.page.getByRole("button", { name: /new|create|add storage|add freezer/i }).click();
    await this.page.getByLabel(/name/i).fill(name);
    await this.page.getByRole("button", { name: /save|create|confirm/i }).click();
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async open(name: string): Promise<void> {
    await this.page.getByText(name).first().click();
  }

  async addReagent(name: string, qty: number, unit: string): Promise<void> {
    await this.page.getByRole("button", { name: /add reagent|new reagent/i }).click();
    await this.page.getByLabel(/name/i).fill(name);
    await this.page.getByLabel(/quantity/i).fill(String(qty));
    const unitSelect = this.page.locator("select#reagentUnit");
    if (await unitSelect.isVisible()) await unitSelect.selectOption(unit);
    await this.page.getByRole("button", { name: /save|add|confirm/i }).click();
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async expectReagentVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }
}
