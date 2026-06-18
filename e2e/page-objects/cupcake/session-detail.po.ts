/**
 * Page object for session detail (/protocols/sessions/:id).
 */
import { Page, expect } from "@playwright/test";

export class SessionDetailPage {
  constructor(private readonly page: Page) {}

  async gotoList(): Promise<void> {
    await this.page.goto("/#/protocols/sessions");
  }

  async createFromProtocol(protocolTitle: string): Promise<void> {
    await this.page.goto("/#/protocols");
    await this.page.locator(".protocol-list-item").filter({ hasText: protocolTitle }).click();
    await this.page.getByRole("button", { name: /start session/i }).click();
    const sessionName = `E2E Session ${Date.now()}`;
    await this.page.locator("#sessionName").fill(sessionName);
    await this.page.locator(".modal-footer .btn-primary").click();
    await expect(this.page).toHaveURL(/\/protocols\/sessions/, { timeout: 15000 });
    await this.page.locator(".list-group-item-action").filter({ hasText: sessionName }).first().click();
    await this.page.locator("button.btn-outline-success[title='Open Session']").click();
    await expect(this.page).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 10000 });
  }

  async addTextAnnotation(stepText: string, content: string): Promise<void> {
    const step = this.page.locator("[class*='step']").filter({ hasText: stepText }).first();
    await step.getByRole("button", { name: /annotate|add annotation|add note/i }).click();
    await this.page.getByRole("textbox").fill(content);
    await this.page.getByRole("button", { name: /save|add|confirm/i }).click();
    await expect(this.page.getByText(content)).toBeVisible({ timeout: 10000 });
  }

  async markStepComplete(stepText: string): Promise<void> {
    const step = this.page.locator("[class*='step']").filter({ hasText: stepText }).first();
    await step.getByRole("checkbox", { name: /complete|done/i }).check();
  }

  async startStepTimer(): Promise<void> {
    await this.page.getByTitle("Start Timer").click();
    await expect(this.page.getByTitle("Pause Timer")).toBeVisible({ timeout: 8000 });
  }

  async pauseStepTimer(): Promise<void> {
    await this.page.getByTitle("Pause Timer").click();
    await expect(this.page.getByTitle("Start Timer")).toBeVisible({ timeout: 8000 });
  }

  async resetStepTimer(): Promise<void> {
    await this.page.getByTitle("Reset Timer").click();
    await expect(this.page.getByTitle("Start Timer")).toBeVisible({ timeout: 5000 });
  }

  async getStepTimerDisplay(): Promise<string> {
    const text = await this.page.locator("span.font-monospace").first().innerText();
    return text.trim();
  }

  stepReagentRow(stepReagentName: string) {
    return this.page.locator(".step-reagents .list-group-item").filter({ hasText: stepReagentName });
  }

  async bookReagent(stepReagentName: string, storageLocationName: string, quantity: number, notes?: string): Promise<void> {
    await this.stepReagentRow(stepReagentName).getByTitle("Book this reagent").click();
    await expect(this.page.locator(".modal-title")).toContainText("Book Reagent");

    const row = this.page.locator(".list-group-item-action").filter({ hasText: storageLocationName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    await this.page.locator("#quantity").fill(String(quantity));
    if (notes) {
      await this.page.locator("#notes").fill(notes);
    }

    const postWait = this.page.waitForResponse(resp => resp.url().includes("/reagent-actions/") && resp.request().method() === "POST", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Book Reagent" }).click();
    await postWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async getStepReagentBookedText(stepReagentName: string): Promise<string> {
    return this.stepReagentRow(stepReagentName).innerText();
  }
}
