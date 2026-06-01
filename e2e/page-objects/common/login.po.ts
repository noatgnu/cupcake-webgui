/**
 * Page object for the login page.
 */
import { Page, expect } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/#/login");
  }

  async login(username: string, password: string): Promise<void> {
    await this.page.getByLabel(/username/i).fill(username);
    await this.page.getByLabel(/password/i).fill(password);
    await this.page.getByRole("button", { name: /login|sign in/i }).click();
  }

  async expectError(): Promise<void> {
    await expect(
      this.page.locator(".alert-danger, [role='alert']")
    ).toBeVisible({ timeout: 5000 });
  }

  async expectRedirectedAwayFromLogin(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login/, { timeout: 10000 });
  }
}
