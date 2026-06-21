/**
 * Page object for the protocol list and editor (/protocols, /protocols/:id/edit).
 */
import { Page, expect } from "@playwright/test";
import { fillReliably } from "./utils";

export class ProtocolEditorPage {
  constructor(private readonly page: Page) {}

  async gotoList(): Promise<void> {
    await this.page.goto("/#/protocols");
  }

  async createProtocol(title: string): Promise<void> {
    await this.page.getByRole("button", { name: /new|create|add protocol/i }).click();
    await this.page.locator(".modal-title").waitFor();
    await fillReliably(this.page.locator("#protocolTitle"), title);
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
    await this.page.locator(".modal-title").waitFor();
    const editor = this.page.locator(".ql-editor[contenteditable='true']");
    await editor.click();
    await editor.fill(stepDescription);
    if (durationMinutes > 0) {
      const minutesInput = this.page.locator(".modal-dialog .duration-input input").nth(2);
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

  stepListItem(stepDescription: string) {
    return this.page.locator(".list-group-item").filter({ hasText: stepDescription });
  }

  async addStepReagent(stepDescription: string, reagentName: string, unit: string, quantity: number): Promise<number> {
    await this.stepListItem(stepDescription).getByTitle("Add Reagent").click();
    await this.page.locator(".modal-title").waitFor();
    await fillReliably(this.page.locator("#reagentName"), reagentName);
    await this.page.locator("#reagentUnit").selectOption(unit);
    await this.page.locator("#quantity").fill(String(quantity));
    const [response] = await Promise.all([
      this.page.waitForResponse(resp => resp.url().includes("/step-reagents/") && resp.request().method() === "POST"),
      this.page.locator(".modal-footer .btn-primary").click(),
    ]);
    await expect(this.page.getByText(reagentName).first()).toBeVisible({ timeout: 10000 });
    const body = await response.json();
    return body.id;
  }

  async insertReagentTemplateIntoStep(
    stepDescription: string,
    property: "name" | "quantity" | "unit" | "scaled_quantity" = "quantity"
  ): Promise<void> {
    const iconMap: Record<string, string> = {
      quantity: "bi-123",
      unit: "bi-rulers",
      name: "bi-tag",
      scaled_quantity: "bi-calculator",
    };
    const [editStepResponse] = await Promise.all([
      this.page.waitForResponse(resp => resp.url().includes("/step-reagents/") && resp.request().method() === "GET", { timeout: 30000 }),
      this.stepListItem(stepDescription).getByTitle("Edit Step").click(),
    ]);
    await editStepResponse.finished();
    await expect(this.page.locator(".modal-title")).toContainText("Edit Step");
    await this.page.locator("table tbody tr").first().locator(`button:has(i.${iconMap[property]})`).click({ timeout: 15000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: /save changes/i }).click();
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async getStepTemplateValue(stepDescription: string): Promise<string> {
    return this.stepListItem(stepDescription).locator(".template-value").first().innerText();
  }
}
