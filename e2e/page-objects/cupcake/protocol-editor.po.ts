/**
 * Page object for the protocol editor (/protocols/:id/edit).
 */
import { Page, expect } from "@playwright/test";

export class ProtocolEditorPage {
  constructor(private readonly page: Page) {}

  async gotoList(): Promise<void> {
    await this.page.goto("/#/protocols");
  }

  async createProtocol(title: string): Promise<void> {
    await this.page.getByRole("button", { name: /new|create|add protocol/i }).click();
    await this.page.getByLabel(/title|name/i).fill(title);
    await this.page.getByRole("button", { name: /save|create|confirm/i }).click();
    await expect(this.page.getByText(title)).toBeVisible({ timeout: 10000 });
  }

  async openEditor(title: string): Promise<void> {
    const row = this.page.locator("tr, [role='row'], mat-row").filter({ hasText: title });
    await row.getByRole("button", { name: /edit/i }).click();
    await expect(this.page).toHaveURL(/\/protocols\/\d+\/edit/, { timeout: 10000 });
  }

  async addSection(description: string): Promise<void> {
    await this.page.getByRole("button", { name: /add section/i }).click();
    await this.page.getByLabel(/description|name/i).fill(description);
    await this.page.getByRole("button", { name: /save|add|confirm/i }).click();
    await expect(this.page.getByText(description)).toBeVisible({ timeout: 10000 });
  }

  async addStep(sectionText: string, stepDescription: string, durationMinutes: number): Promise<void> {
    const section = this.page.locator("[class*='section']").filter({ hasText: sectionText });
    await section.getByRole("button", { name: /add step/i }).click();
    await this.page.getByLabel(/description/i).fill(stepDescription);
    const durationInput = this.page.getByLabel(/duration/i);
    if (await durationInput.isVisible()) {
      await durationInput.fill(String(durationMinutes));
    }
    await this.page.getByRole("button", { name: /save|add|confirm/i }).click();
    await expect(this.page.getByText(stepDescription)).toBeVisible({ timeout: 10000 });
  }

  async deleteProtocol(title: string): Promise<void> {
    const row = this.page.locator("tr, [role='row']").filter({ hasText: title });
    await row.getByRole("button", { name: /delete|remove/i }).click();
    await this.page.getByRole("button", { name: /confirm|yes|delete/i }).click();
    await expect(this.page.getByText(title)).not.toBeVisible({ timeout: 10000 });
  }
}
