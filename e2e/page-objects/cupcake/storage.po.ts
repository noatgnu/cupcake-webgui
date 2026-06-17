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

  async createChildStorage(name: string): Promise<void> {
    await this.page.getByTitle("Add child storage").click();
    await this.page.getByLabel(/name/i).fill(name);
    await this.page.getByRole("button", { name: /save|create|confirm/i }).click();
    await expect(this.page.locator(".storage-panel-left").getByText(name)).toBeVisible({ timeout: 10000 });
  }

  reagentRow(reagentName: string) {
    return this.page.locator(".storage-panel-right .list-group-item").filter({ hasText: reagentName });
  }

  async addQuantity(reagentName: string, qty: number, notes?: string): Promise<void> {
    await this.reagentRow(reagentName).getByTitle("Add Quantity").click();
    await this.page.locator("#quantity").fill(String(qty));
    if (notes) {
      await this.page.locator("#notes").fill(notes);
    }
    await this.page.locator(".modal-footer .btn-primary").click();
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async reserveQuantity(reagentName: string, qty: number, notes?: string): Promise<void> {
    await this.reagentRow(reagentName).getByTitle("Reserve Quantity").click();
    await this.page.locator("#quantity").fill(String(qty));
    if (notes) {
      await this.page.locator("#notes").fill(notes);
    }
    await this.page.locator(".modal-footer .btn-danger").click();
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async getReagentRowText(reagentName: string): Promise<string> {
    return this.reagentRow(reagentName).innerText();
  }

  async searchReagents(term: string): Promise<void> {
    await this.page.getByPlaceholder("Search reagents...").fill(term);
  }
}
