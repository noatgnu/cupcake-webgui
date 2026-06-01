/**
 * Page object for the main navigation bar.
 */
import { Page } from "@playwright/test";

export class NavbarPage {
  constructor(private readonly page: Page) {}

  async logout(): Promise<void> {
    await this.page.getByRole("button", { name: /profile|account|user/i }).click();
    await this.page.getByRole("menuitem", { name: /logout|sign out/i }).click();
  }
}
