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
    return this.page.locator(".timer-compact .fw-bold, .timer-display .fw-bold").first().innerText();
  }
}
