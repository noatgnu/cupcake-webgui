/**
 * Page object for lab groups (/lab-groups).
 */
import { Page, expect } from "@playwright/test";

export class LabGroupsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/#/home/lab-groups");
  }

  async create(name: string): Promise<void> {
    await this.page.getByRole("button", { name: /new|create|add lab group/i }).click();
    await this.page.getByLabel(/name/i).fill(name);
    await this.page.getByRole("button", { name: /save|create|confirm/i }).click();
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async open(name: string): Promise<void> {
    await this.page.getByText(name).first().click();
  }

  async inviteUser(username: string): Promise<void> {
    await this.page.getByRole("button", { name: /invite|add member/i }).click();
    await this.page.getByLabel(/username|user/i).fill(username);
    await this.page.getByRole("button", { name: /invite|add|confirm/i }).click();
    await expect(this.page.getByText(username)).toBeVisible({ timeout: 10000 });
  }
}
