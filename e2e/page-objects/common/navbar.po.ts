/**
 * Page object for the main navigation bar.
 */
import { Page } from "@playwright/test";

export class NavbarPage {
  constructor(private readonly page: Page) {}

  async logout(): Promise<void> {
    await this.page.getByRole("button", { name: /logout/i }).click();
  }
}
