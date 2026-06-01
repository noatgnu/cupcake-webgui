/**
 * Page object for the protocol list and editor (/protocols, /protocols/:id/edit).
 */
import { Page, expect } from "@playwright/test";

export class ProtocolEditorPage {
  constructor(private readonly page: Page) {}

  async gotoList(): Promise<void> {
    await this.page.goto("/#/protocols");
  }

  async createProtocol(title: string): Promise<void> {
    await this.page.getByRole("button", { name: /new|create|add protocol/i }).click();
    await this.page.locator("#protocolTitle").fill(title);
    await this.page.locator(".modal-footer .btn-primary").click();
    await expect(this.page).toHaveURL(/\/protocols\/\d+\/edit/, { timeout: 15000 });
  }

  async openEditor(title: string): Promise<void> {
    await this.page.locator(".protocol-list-item").filter({ hasText: title }).click();
    await this.page.getByTitle("Edit Protocol").click();
    await expect(this.page).toHaveURL(/\/protocols\/\d+\/edit/, { timeout: 10000 });
  }

  async addSection(description: string): Promise<void> {
    await this.page.getByTitle("Add Section").click();
    await this.page.locator("#sectionDescription").fill(description);
    await this.page.locator(".protocol-panel-left .card-footer button.btn-success").click();
    await expect(this.page.locator(".list-group-item").filter({ hasText: description })).toBeVisible({ timeout: 10000 });
  }

  async addStep(sectionText: string, stepDescription: string, durationMinutes: number): Promise<void> {
    await this.page.locator(".list-group-item-action").filter({ hasText: sectionText }).click();
    await this.page.locator("button.btn-sm.btn-primary", { hasText: /add step/i }).click();
    const editor = this.page.locator(".ql-editor[contenteditable='true']");
    await editor.click();
    await editor.fill(stepDescription);
    if (durationMinutes > 0) {
      const minutesInput = this.page.locator(".duration-input input").nth(2);
      await minutesInput.fill(String(durationMinutes));
    }
    await this.page.locator(".modal-footer .btn-primary").click();
    await expect(this.page.getByText(stepDescription)).toBeVisible({ timeout: 10000 });
  }

  async deleteProtocol(title: string): Promise<void> {
    const item = this.page.locator(".protocol-list-item").filter({ hasText: title });
    if (!await item.isVisible({ timeout: 2000 })) return;
    await item.click();
    await this.page.getByRole("button", { name: /delete/i }).click();
    const confirmBtn = this.page.getByRole("button", { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 3000 })) {
      await confirmBtn.click();
    }
    await expect(item).not.toBeVisible({ timeout: 10000 });
  }
}
