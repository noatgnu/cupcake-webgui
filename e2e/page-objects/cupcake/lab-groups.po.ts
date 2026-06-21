/**
 * Page object for lab groups (/home/lab-groups).
 */
import { Page, expect } from "@playwright/test";
import { fillReliably } from "./utils";

export class LabGroupsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/#/home/lab-groups");
  }

  async create(name: string): Promise<void> {
    await this.page.getByRole("button", { name: "Create Lab Group" }).click();
    await this.page.locator(".modal-title").waitFor();
    await fillReliably(this.page.locator("#name"), name);
    const postWait = this.page.waitForResponse(resp => resp.url().includes("/lab-groups/") && resp.request().method() === "POST", { timeout: 30000 });
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/lab-groups/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await postWait;
    await refreshWait;
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async open(name: string): Promise<void> {
    await this.page.getByText(name).first().click();
  }

  /**
   * Invites a user from the currently open lab group. Invites only ever
   * create a pending LabGroupInvitation (regardless of inviter staff status),
   * so this returns the created invitation id for a test to drive the
   * separate accept flow as the invited user.
   */
  async inviteUser(username: string): Promise<number> {
    await this.page.getByRole("button", { name: /add member|invite/i }).click();
    await this.page.locator(".modal-title").waitFor();
    await fillReliably(this.page.locator("#search"), username);
    const row = this.page.locator(".list-group-item").filter({ hasText: username });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.locator('input[type="radio"]').check();

    const [response] = await Promise.all([
      this.page.waitForResponse(resp => resp.url().includes("/invite_user/") && resp.request().method() === "POST"),
      this.page.getByRole("button", { name: /add member|send invitation/i }).click(),
    ]);
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
    const body = await response.json();
    return body.id;
  }
}
