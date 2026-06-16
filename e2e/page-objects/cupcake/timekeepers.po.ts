/**
 * Page object for the standalone timekeepers page (/protocols/timers).
 */
import { Page, expect, Locator } from "@playwright/test";

export class TimekeepersPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/#/protocols/timers");
    await expect(this.page).toHaveURL(/\/protocols\/timers/, { timeout: 10000 });
  }

  async createTimer(name: string, durationSeconds: number): Promise<void> {
    await this.page.locator("button.btn-primary.btn-sm", { hasText: /new timer/i }).click();
    await this.page.locator("#timerName").fill(name);
    await this.page.locator("#timerDuration").fill(String(durationSeconds));
    await this.page.locator(".modal-footer .btn-primary").click();
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  timerListItem(name: string): Locator {
    return this.page.locator(".timer-list-item").filter({ hasText: name });
  }

  async selectTimer(name: string): Promise<void> {
    await this.timerListItem(name).click();
    await expect(this.page.locator("button[title='Start'], button[title='Pause']")).toBeVisible({
      timeout: 5000,
    });
  }

  async startSelectedTimer(): Promise<void> {
    await this.page.getByTitle("Start").click();
    await expect(this.page.getByTitle("Pause")).toBeVisible({ timeout: 5000 });
  }

  async pauseSelectedTimer(): Promise<void> {
    await this.page.getByTitle("Pause").click();
    await expect(this.page.getByTitle("Start")).toBeVisible({ timeout: 5000 });
    let prev = '';
    for (let i = 0; i < 20; i++) {
      await this.page.waitForTimeout(100);
      const curr = await this.page.locator(".timer-time-display-large").innerText();
      if (curr === prev) break;
      prev = curr;
    }
  }

  async resetSelectedTimer(): Promise<void> {
    await this.page.getByTitle("Reset").click();
  }

  async getDisplayedTime(): Promise<string> {
    return this.page.locator(".timer-time-display-large").innerText();
  }

  async waitForTimerToDecrease(initialTime: string, waitMs = 2500): Promise<string> {
    await this.page.waitForTimeout(waitMs);
    const after = await this.getDisplayedTime();
    expect(after).not.toBe(initialTime);
    return after;
  }
}
