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
    await this.page.getByRole("button", { name: /new session|create session/i }).click();
    const protocolOption = this.page.getByText(protocolTitle).first();
    await expect(protocolOption).toBeVisible({ timeout: 10000 });
    await protocolOption.click();
    await this.page.getByRole("button", { name: /create|start|confirm/i }).click();
    await expect(this.page).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
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
}
